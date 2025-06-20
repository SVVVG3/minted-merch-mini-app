import * as frame from '@farcaster/frame-sdk'

export async function initializeFrame() {
  const context = await frame.sdk.context

  if (!context || !context.user) {
    console.log('not in frame context')
    return
  }

  const user = context.user

  window.userFid = user.fid;

  // Call the ready function to remove splash screen when in a frame
  await frame.sdk.actions.ready();
}

export { frame };