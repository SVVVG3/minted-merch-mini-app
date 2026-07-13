import { supabaseAdmin } from '@/lib/supabase';
import { getProductConfig } from '@/lib/designStudioConfig';
import { createPrintfulTemplate } from '@/lib/printfulTemplates';

function defaultListingSize(productType) {
  const config = getProductConfig(productType);
  if (!config?.sizes?.length) return 'M';
  if (config.sizes.includes('One Size')) return 'One Size';
  if (config.sizes.includes('M')) return 'M';
  return config.sizes[0];
}

/**
 * Creates a design_order_requests row + Printful draft order when a drop winner is selected.
 * Idempotent per drop_submission_id — safe to retry if Printful failed previously.
 */
export async function createPrintfulDraftForDropWinner(submissionId, dropId) {
  const { data: existing } = await supabaseAdmin
    .from('design_order_requests')
    .select('id, printful_order_id, printful_order_status')
    .eq('drop_submission_id', submissionId)
    .maybeSingle();

  if (existing?.printful_order_id) {
    return {
      success: true,
      designRequestId: existing.id,
      printfulOrderId: existing.printful_order_id,
      alreadyExists: true,
    };
  }

  if (existing?.id) {
    const result = await createPrintfulTemplate(existing.id, null, null);
    return { ...result, designRequestId: existing.id };
  }

  const { data: submission, error: subErr } = await supabaseAdmin
    .from('drop_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('drop_id', dropId)
    .single();

  if (subErr || !submission) {
    return { success: false, error: 'Drop submission not found' };
  }

  const { data: mockup, error: mockupErr } = await supabaseAdmin
    .from('design_studio_mockups')
    .select('*')
    .eq('id', submission.mockup_id)
    .single();

  if (mockupErr || !mockup) {
    return { success: false, error: 'Winning mockup not found' };
  }

  const productType = mockup.product_type || submission.product_type;
  const productConfig = getProductConfig(productType);
  if (!productConfig) {
    return { success: false, error: `Unknown product type: ${productType}` };
  }

  const technique = mockup.technique || productConfig.technique || null;
  const storedTechnique = productConfig.printfulTechnique || technique;

  const { data: designReq, error: insertErr } = await supabaseAdmin
    .from('design_order_requests')
    .insert({
      fid: submission.fid,
      product_type: productType,
      size: defaultListingSize(productType),
      color_name: mockup.color_name || submission.color_name,
      technique: storedTechnique === 'DTG' ? null : storedTechnique,
      design_url: mockup.design_url || submission.design_url,
      mockup_url: mockup.mockup_url || submission.mockup_url,
      placement: mockup.placement || productConfig.placement,
      design_scale: mockup.design_scale,
      printful_product_id: productConfig.printfulProductId,
      printful_variant_ids: mockup.printful_variant_ids || null,
      position_data: mockup.position_data || null,
      drop_id: dropId,
      drop_submission_id: submissionId,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[dropPrintful] design_order_requests insert error:', insertErr);
    return { success: false, error: insertErr.message };
  }

  await supabaseAdmin
    .from('weekly_drops')
    .update({
      design_request_id: designReq.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dropId);

  const result = await createPrintfulTemplate(designReq.id, null, null);
  return { ...result, designRequestId: designReq.id };
}
