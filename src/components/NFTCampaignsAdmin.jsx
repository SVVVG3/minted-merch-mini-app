'use client';

import { useState, useEffect } from 'react';

// Helper function for admin API calls (with auth token)
const adminFetch = async (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'X-Admin-Token': token
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.reload();
    throw new Error('Session expired');
  }
  
  return response;
};

export default function NFTCampaignsAdmin() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form state for creating new campaign
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    description: '',
    contractAddress: '',
    contractChainId: 8453,
    contractType: 'ERC1155',
    tokenId: '0',
    tokenRewardAmount: '100000000000000000000000', // 100k tokens
    maxSupply: '',
    imageUrl: '',
    shareText: '',
    shareEmbeds: '',
    ogImageText: '',
    buttonText: 'WEN MERCH?'
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fetch campaigns
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await adminFetch('/api/admin/nft-campaigns');
      const data = await response.json();
      
      if (data.success) {
        setCampaigns(data.campaigns);
      } else {
        setError(data.error || 'Failed to fetch campaigns');
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle create campaign
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    try {
      // Build metadata object
      const metadata = {
        shareText: formData.shareText,
        shareEmbeds: formData.shareEmbeds.split(',').map(s => s.trim()).filter(Boolean),
        ogImageText: formData.ogImageText,
        buttonText: formData.buttonText
      };

      const response = await adminFetch('/api/admin/nft-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: formData.slug,
          title: formData.title,
          description: formData.description,
          contractAddress: formData.contractAddress,
          contractChainId: parseInt(formData.contractChainId),
          contractType: formData.contractType,
          tokenId: formData.tokenId,
          tokenRewardAmount: formData.tokenRewardAmount,
          maxSupply: formData.maxSupply ? parseInt(formData.maxSupply) : null,
          imageUrl: formData.imageUrl,
          metadata
        })
      });

      const data = await response.json();

      if (data.success) {
        // Reset form
        setFormData({
          slug: '',
          title: '',
          description: '',
          contractAddress: '',
          contractChainId: 8453,
          contractType: 'ERC1155',
          tokenId: '0',
          tokenRewardAmount: '100000000000000000000000',
          maxSupply: '',
          imageUrl: '',
          shareText: '',
          shareEmbeds: '',
          ogImageText: '',
          buttonText: 'WEN MERCH?'
        });
        setShowCreateForm(false);
        fetchCampaigns(); // Refresh list
      } else {
        setCreateError(data.error || 'Failed to create campaign');
      }
    } catch (err) {
      console.error('Error creating campaign:', err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Toggle campaign active status
  const toggleActive = async (id, currentStatus) => {
    try {
      const response = await adminFetch(`/api/admin/nft-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (response.ok) {
        fetchCampaigns(); // Refresh list
      }
    } catch (err) {
      console.error('Error toggling campaign:', err);
    }
  };

  // Delete campaign
  const handleDelete = async (id, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await adminFetch(`/api/admin/nft-campaigns/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCampaigns(); // Refresh list
      }
    } catch (err) {
      console.error('Error deleting campaign:', err);
      alert('Failed to delete campaign');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-lg">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">NFT Campaigns</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : '+ Create Campaign'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-gray-100 p-6 rounded-lg space-y-4">
          <h3 className="text-xl font-bold mb-4">Create New Campaign</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({...formData, slug: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="beeper"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="WEN BEEPER MERCH?"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              rows="3"
              placeholder="Mint this exclusive NFT and claim 100,000 $MINTEDMERCH tokens!"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Contract Address</label>
              <input
                type="text"
                required
                value={formData.contractAddress}
                onChange={(e) => setFormData({...formData, contractAddress: e.target.value})}
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Max Supply</label>
              <input
                type="number"
                value={formData.maxSupply}
                onChange={(e) => setFormData({...formData, maxSupply: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="4000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="text"
              required
              value={formData.imageUrl}
              onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              placeholder="/beeper-dino.png or https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Share Text</label>
            <textarea
              value={formData.shareText}
              onChange={(e) => setFormData({...formData, shareText: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              rows="2"
              placeholder="Just minted the WEN BEEPER MERCH? NFT! 🦖"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Share Embeds (comma-separated)</label>
              <input
                type="text"
                value={formData.shareEmbeds}
                onChange={(e) => setFormData({...formData, shareEmbeds: e.target.value})}
                className="w-full px-3 py-2 border rounded text-sm"
                placeholder="https://app.mintedmerch.shop, https://beep.works/app"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">OG Image Text</label>
              <input
                type="text"
                value={formData.ogImageText}
                onChange={(e) => setFormData({...formData, ogImageText: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="Minted 1x WEN BEEPER MERCH?"
              />
            </div>
          </div>

          {createError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {createError}
            </div>
          )}

          <button
            type="submit"
            disabled={createLoading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {createLoading ? 'Creating...' : 'Create Campaign'}
          </button>
        </form>
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No campaigns yet. Create your first campaign!
          </div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign.id} className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{campaign.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      campaign.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-3">{campaign.description}</p>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Slug</div>
                      <div className="font-medium">/mint/{campaign.slug}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total Mints</div>
                      <div className="font-medium text-lg">{campaign.total_mints}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Max Supply</div>
                      <div className="font-medium">{campaign.max_supply || 'Unlimited'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Claims</div>
                      <div className="font-medium">{campaign.total_claims || 0}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-500 font-mono">
                    Contract: {campaign.contract_address}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => toggleActive(campaign.id, campaign.is_active)}
                    className={`px-3 py-1 rounded text-sm ${
                      campaign.is_active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {campaign.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  
                  <a
                    href={`/mint/${campaign.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                  >
                    View
                  </a>

                  <button
                    onClick={() => handleDelete(campaign.id, campaign.title)}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

