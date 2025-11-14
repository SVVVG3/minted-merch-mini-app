'use client';

import { useState, useEffect } from 'react';
import UserModal from '@/components/UserModal';
import { ChatAdminDashboard } from '@/components/ChatAdminDashboard';

// CRITICAL SECURITY: Helper function to make authenticated admin API calls
const adminFetch = async (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  
  if (!token) {
    throw new Error('No authentication token found. Please log in again.');
  }
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'X-Admin-Token': token // Fallback header
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // If we get a 401, the token is invalid - clear it and reload
  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }
  
  return response;
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dashboard data state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [ordersData, setOrdersData] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Raffle state
  const [raffleFilters, setRaffleFilters] = useState({
    minPoints: 0,
    minStreak: 0,
    minPurchasePoints: 0,
    minTokenBalance: 0,
    excludePreviousWinners: true
  });
  const [raffleResults, setRaffleResults] = useState([]);
  const [winnerProfiles, setWinnerProfiles] = useState({});
  const [numWinners, setNumWinners] = useState(1);
  
  // Past Raffles state
  const [pastRaffles, setPastRaffles] = useState([]);
  const [pastRafflesLoading, setPastRafflesLoading] = useState(false);
  const [pastRafflesError, setPastRafflesError] = useState('');

  // Notifications state
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);
  const [showNotificationConfirm, setShowNotificationConfirm] = useState(null);

  // Check-ins state
  const [checkinsData, setCheckinsData] = useState([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [checkinsError, setCheckinsError] = useState('');
  const [checkinsSortField, setCheckinsSortField] = useState('created_at');
  const [checkinsSortDirection, setCheckinsSortDirection] = useState('desc');

  // Users state
  const [usersData, setUsersData] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  
  // Users sorting state
  const [usersSortField, setUsersSortField] = useState('updated_at');
  const [usersSortDirection, setUsersSortDirection] = useState('desc');
  
  // Orders sorting state
  const [ordersSortField, setOrdersSortField] = useState('created_at');
  const [ordersSortDirection, setOrdersSortDirection] = useState('desc');
  
  // User modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserFid, setSelectedUserFid] = useState(null);

  // Admin Tools state
  const [resetSpinFid, setResetSpinFid] = useState('');
  const [resetSpinReason, setResetSpinReason] = useState('');
  const [resetSpinNote, setResetSpinNote] = useState('');
  const [resetSpinLoading, setResetSpinLoading] = useState(false);
  const [resetSpinResult, setResetSpinResult] = useState(null);
  
  // Order edit modal state
  const [orderEditModalOpen, setOrderEditModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderEditData, setOrderEditData] = useState({});
  
  // Leaderboard sorting state
  const [sortField, setSortField] = useState('total_points');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Discounts state
  const [discountsData, setDiscountsData] = useState([]);
  const [showCreateDiscount, setShowCreateDiscount] = useState(false);
  const [productsData, setProductsData] = useState([]);
  const [productsSyncLoading, setProductsSyncLoading] = useState(false);
  const [collectionsData, setCollectionsData] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [copiedButtons, setCopiedButtons] = useState(new Set());
  const [showEditDiscount, setShowEditDiscount] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  
  // Partners state
  const [partnersData, setPartnersData] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState('');
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [createPartnerData, setCreatePartnerData] = useState({
    name: '',
    email: '',
    password: '',
    fid: '',
    partner_type: 'fulfillment'
  });
  
  // Partners sub-tab state
  const [partnersSubTab, setPartnersSubTab] = useState('partners'); // 'partners' or 'ambassadors'
  
  // Ambassadors state
  const [ambassadorsData, setAmbassadorsData] = useState([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(false);
  const [ambassadorsError, setAmbassadorsError] = useState('');
  const [showAddAmbassador, setShowAddAmbassador] = useState(false);
  const [addAmbassadorFid, setAddAmbassadorFid] = useState('');
  const [addAmbassadorNotes, setAddAmbassadorNotes] = useState('');
  
  // Bounties state (for ambassadors sub-tab)
  const [bountiesData, setBountiesData] = useState([]);
  const [bountiesLoading, setBountiesLoading] = useState(false);
  const [bountiesError, setBountiesError] = useState('');
  const [showCreateBounty, setShowCreateBounty] = useState(false);
  const [selectedBountyForEdit, setSelectedBountyForEdit] = useState(null);
  
  // Submissions state (for ambassadors sub-tab)
  const [submissionsData, setSubmissionsData] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState('');
  const [submissionsFilter, setSubmissionsFilter] = useState('pending'); // 'all', 'pending', 'approved', 'rejected'
  
  // Payouts state (for ambassadors sub-tab)
  const [payoutsData, setPayoutsData] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState('');
  const [payoutsFilter, setPayoutsFilter] = useState('pending'); // 'all', 'pending', 'processing', 'completed'
  const [selectedPayoutForComplete, setSelectedPayoutForComplete] = useState(null);
  const [copiedWallet, setCopiedWallet] = useState(null); // Track which wallet was copied
  
  // Ambassador section view (within ambassadors sub-tab)
  const [ambassadorView, setAmbassadorView] = useState('ambassadors'); // 'ambassadors', 'bounties', 'submissions', 'payouts'

  // Discounts filtering and sorting state
  const [discountFilters, setDiscountFilters] = useState({
    searchTerm: '',
    gatingType: 'all',
    codeType: 'all',
    status: 'all',
    discountScope: 'all'
  });
  const [discountSortField, setDiscountSortField] = useState('created_at');
  const [discountSortDirection, setDiscountSortDirection] = useState('desc');
  
  // Discounts pagination state
  const [discountPagination, setDiscountPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Check for existing token on component mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
      loadDashboardData();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success && data.token) {
        // Store the JWT token in localStorage
        localStorage.setItem('admin_token', data.token);
        console.log('✅ Admin logged in successfully');
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setPassword('');
  };

  const loadDiscounts = async (page = 1, limit = 50, filters = discountFilters) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: filters.searchTerm || '',
        gatingType: filters.gatingType || 'all',
        codeType: filters.codeType || 'all',
        status: filters.status || 'all',
        discountScope: filters.discountScope || 'all'
      });

      const response = await adminFetch(`/api/admin/discounts?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setDiscountsData(result.data || []);
        setDiscountPagination(result.pagination);
      } else {
        console.error('Failed to load discounts:', result.error);
      }
    } catch (error) {
      console.error('Failed to load discounts:', error);
    }
  };

  // Handle filter changes - reset to page 1 and reload
  const handleFilterChange = (filterKey, filterValue) => {
    const newFilters = { ...discountFilters, [filterKey]: filterValue };
    setDiscountFilters(newFilters);
    loadDiscounts(1, discountPagination.limit, newFilters);
  };

  const loadDashboardData = async () => {
    try {
      const [leaderboardRes, statsRes, ordersRes, productsRes, collectionsRes] = await Promise.all([
        adminFetch(`/api/admin/leaderboard?limit=10000&sortBy=${sortField}`),
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/orders'),
        fetch('/api/products'),
        fetch('/api/shopify/collections')
      ]);
      
      const leaderboard = await leaderboardRes.json();
      const stats = await statsRes.json();
      const orders = await ordersRes.json();
      const products = await productsRes.json();
      const collections = await collectionsRes.json();
      
      setLeaderboardData(leaderboard.data || []);
      setDashboardStats(stats.data);
      setOrdersData(orders.data || []);
      setProductsData(products.products || []);
      setCollectionsData(collections || []);
      
      // Load discounts separately with pagination
      await loadDiscounts(1, 50);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  // User modal functions
  const openUserModal = (fid) => {
    setSelectedUserFid(fid);
    setUserModalOpen(true);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    setSelectedUserFid(null);
  };

  // Admin Tools functions
  const handleResetDailySpin = async () => {
    if (!resetSpinFid.trim()) {
      setResetSpinResult({ success: false, error: 'Please enter a FID' });
      return;
    }

    setResetSpinLoading(true);
    setResetSpinResult(null);

    try {
      const response = await adminFetch('/api/admin/reset-daily-spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: parseInt(resetSpinFid),
          reason: resetSpinReason.trim() || 'State mismatch between contract and database',
          adminNote: resetSpinNote.trim() || 'Manual reset by admin'
        })
      });

      const result = await response.json();
      setResetSpinResult(result);

      if (result.success) {
        // Clear form on success
        setResetSpinFid('');
        setResetSpinReason('');
        setResetSpinNote('');
      }
    } catch (error) {
      console.error('Reset daily spin error:', error);
      setResetSpinResult({ 
        success: false, 
        error: 'Network error. Please try again.' 
      });
    } finally {
      setResetSpinLoading(false);
    }
  };

  // Format token balance for display
  const formatTokenBalance = (balance) => {
    if (!balance || balance === 0) return '0';
    
    // Balance is now stored in tokens (not wei), so no conversion needed
    const tokenAmount = typeof balance === 'string' ? parseFloat(balance) : balance;
    
    if (tokenAmount >= 1000000000) {
      // Show billions (B) for amounts >= 1 billion
      return `${(tokenAmount / 1000000000).toFixed(3)}B`;
    } else if (tokenAmount >= 1000000) {
      // Show millions (M) for amounts >= 1 million
      return `${(tokenAmount / 1000000).toFixed(1)}M`;
    } else if (tokenAmount >= 1000) {
      // Show thousands (K) for amounts >= 1 thousand
      return `${(tokenAmount / 1000).toFixed(1)}K`;
    } else if (tokenAmount >= 1) {
      return tokenAmount.toFixed(2);
    } else {
      return tokenAmount.toFixed(6);
    }
  };

  // Order edit modal functions
  const openOrderEditModal = (order) => {
    setSelectedOrder(order);
    setOrderEditData({
      status: order.status,
      tracking_number: order.tracking_number || '',
      carrier: order.carrier || '',
      customer_name: order.customer_name || '',
      customer_email: order.customer_email || '',
      shipping_address: order.shipping_address || {},
      assigned_partner_id: order.assigned_partner_id || ''
    });
    setOrderEditModalOpen(true);
    // Load partners for assignment if not already loaded
    if (partnersData.length === 0) {
      loadPartners();
    }
  };

  const closeOrderEditModal = () => {
    setOrderEditModalOpen(false);
    setSelectedOrder(null);
    setOrderEditData({});
  };

  // Function to generate tracking URL based on tracking number
  const generateTrackingUrl = (trackingNumber) => {
    if (!trackingNumber) return null;
    
    // For GM tracking numbers from fulfillment service
    if (trackingNumber.startsWith('GM533396')) {
      // Extract 8 digits starting at position 8 (0-indexed)
      const baseNumber = trackingNumber.substring(8, 16);
      return `https://myorders.co/tracking/${baseNumber}/${trackingNumber}`;
    } 
    
    // For manual orders (partner products, etc.) - use default base number
    return `https://myorders.co/tracking/65859081/${trackingNumber}`;
  };

  const handleOrderUpdate = async () => {
    if (!selectedOrder) return;

    try {
      // Auto-generate tracking URL based on tracking number
      const updateData = {
        ...orderEditData,
        tracking_url: generateTrackingUrl(orderEditData.tracking_number)
      };

      const response = await adminFetch(`/api/admin/orders/${encodeURIComponent(selectedOrder.order_id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Refresh the orders data
        loadDashboardData();
        closeOrderEditModal();
        alert('Order updated successfully!');
      } else {
        alert('Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order');
    }
  };

  const runRaffle = async (winnersCount = null, customFilters = null, criteriaDescription = null) => {
    try {
      const winners = winnersCount || numWinners;
      const filters = customFilters || raffleFilters;
      
      const response = await adminFetch('/api/admin/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numWinners: winners,
          filters: filters
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Generate criteria description if not provided
        const description = criteriaDescription || generateCriteriaDescription(filters, result.data.eligibleCount);
        
        // Add criteria description to the result
        const resultWithDescription = {
          ...result.data,
          criteriaDescription: description,
          timestamp: new Date().toISOString()
        };
        
        // Add to results array instead of replacing
        setRaffleResults(prev => [...prev, resultWithDescription]);
        
        // Fetch user profiles for winners
        const fids = result.data.winners.map(w => w.user_fid);
        const profilesResponse = await fetch('/api/user-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fids })
        });
        
        if (profilesResponse.ok) {
          const profilesResult = await profilesResponse.json();
          if (profilesResult.success) {
            // Fix: Use users object from API response, not data array
            const newProfiles = profilesResult.users || {};
            setWinnerProfiles(prev => ({
              ...prev,
              ...newProfiles
            }));
          }
        }
      } else {
        setError(result.error || 'Raffle failed');
      }
    } catch (error) {
      setError('Raffle execution failed');
    }
  };

  const generateCriteriaDescription = (filters, eligibleCount) => {
    const criteria = [];
    
    if (filters.minPoints > 0) {
      criteria.push(`${filters.minPoints}+ points`);
    }
    
    if (filters.minStreak > 0) {
      criteria.push(`${filters.minStreak}+ day streak`);
    }
    
    if (filters.minPurchasePoints > 0) {
      criteria.push(`${filters.minPurchasePoints}+ purchase points`);
    }
    
    if (filters.minTokenBalance > 0) {
      criteria.push(`${filters.minTokenBalance.toLocaleString()}+ tokens`);
    }
    
    if (criteria.length === 0) {
      return `Selected from ${eligibleCount} community members`;
    }
    
    return `Selected from ${eligibleCount} members with ${criteria.join(', ')}`;
  };

  // Quick raffle functions for top users
  const runTopUsersRaffle = async (topCount, sortBy = 'total_points') => {
    if (!leaderboardData || leaderboardData.length === 0) {
      setError('Leaderboard data not loaded');
      return;
    }

    // Sort users by the specified criteria
    const sortedUsers = [...leaderboardData].sort((a, b) => {
      if (sortBy === 'total_points') return b.total_points - a.total_points;
      if (sortBy === 'checkin_streak') return b.checkin_streak - a.checkin_streak;
      if (sortBy === 'points_from_purchases') return b.points_from_purchases - a.points_from_purchases;
      return 0;
    });

    // Get the minimum threshold for the top N users
    const topUsers = sortedUsers.slice(0, topCount);
    if (topUsers.length === 0) {
      setError('No users found for top raffle');
      return;
    }

    const minThreshold = topUsers[topUsers.length - 1][sortBy];
    
    // Create filter to include only top N users
    const topUserFilters = { ...raffleFilters };
    if (sortBy === 'total_points') topUserFilters.minPoints = minThreshold;
    if (sortBy === 'checkin_streak') topUserFilters.minStreak = minThreshold;
    if (sortBy === 'points_from_purchases') topUserFilters.minPurchasePoints = minThreshold;

    // Generate description for top users raffle
    const criteriaMap = {
      'total_points': 'total points',
      'checkin_streak': 'check-in streak',
      'points_from_purchases': 'purchase points'
    };
    
    const description = `Selected from top ${topCount} users by ${criteriaMap[sortBy]} (${minThreshold}+ ${criteriaMap[sortBy]})`;

    // Run raffle with these filters and description
    await runRaffle(numWinners, topUserFilters, description);
  };

  const clearRaffleResults = () => {
    setRaffleResults([]);
    setWinnerProfiles({});
  };

  // Load past raffles from database
  const loadPastRaffles = async () => {
    setPastRafflesLoading(true);
    setPastRafflesError('');
    
    try {
      const response = await adminFetch('/api/admin/raffle');
      const result = await response.json();
      
      if (result.success) {
        setPastRaffles(result.data.raffles || []);
      } else {
        setPastRafflesError(result.error || 'Failed to load past raffles');
      }
    } catch (error) {
      console.error('Error loading past raffles:', error);
      setPastRafflesError('Failed to load past raffles');
    } finally {
      setPastRafflesLoading(false);
    }
  };

  // Delete past raffle
  const deletePastRaffle = async (raffleId) => {
    if (!confirm('Are you sure you want to delete this raffle? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await adminFetch(`/api/admin/raffle/${raffleId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove from local state
        setPastRaffles(prev => prev.filter(raffle => raffle.raffleId !== raffleId));
      } else {
        alert(result.error || 'Failed to delete raffle');
      }
    } catch (error) {
      console.error('Error deleting raffle:', error);
      alert('Failed to delete raffle');
    }
  };

  // Load users from database
  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    
    try {
      const response = await adminFetch('/api/admin/users');
      const result = await response.json();
      
      if (result.success) {
        // Sort by most recently updated (most recently opened app)
        const sortedUsers = result.data.sort((a, b) => 
          new Date(b.updated_at) - new Date(a.updated_at)
        );
        setUsersData(sortedUsers);
      } else {
        setUsersError(result.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsersError('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  // Load check-ins from database
  const loadCheckinsData = async () => {
    setCheckinsLoading(true);
    setCheckinsError('');
    
    try {
      const response = await adminFetch('/api/admin/checkins');
      const result = await response.json();
      
      if (result.success) {
        setCheckinsData(result.data);
      } else {
        setCheckinsError(result.error || 'Failed to load check-ins');
      }
    } catch (error) {
      console.error('Error loading check-ins:', error);
      setCheckinsError('Failed to load check-ins');
    } finally {
      setCheckinsLoading(false);
    }
  };

  // Load partners from database
  const loadPartners = async () => {
    setPartnersLoading(true);
    setPartnersError('');
    
    try {
      const response = await adminFetch('/api/admin/partners');
      const result = await response.json();
      
      if (result.success) {
        setPartnersData(result.data);
      } else {
        setPartnersError(result.error || 'Failed to load partners');
      }
    } catch (error) {
      console.error('Error loading partners:', error);
      setPartnersError('Failed to load partners');
    } finally {
      setPartnersLoading(false);
    }
  };

  // Create new partner
  const handleCreatePartner = async () => {
    if (!createPartnerData.name || !createPartnerData.email || !createPartnerData.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await adminFetch('/api/admin/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createPartnerData.name,
          email: createPartnerData.email,
          password: createPartnerData.password,
          fid: createPartnerData.fid || null,
          partner_type: createPartnerData.partner_type || 'fulfillment'
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Partner created successfully!');
        setShowCreatePartner(false);
        setCreatePartnerData({ name: '', email: '', password: '', fid: '', partner_type: 'fulfillment' });
        loadPartners(); // Refresh the list
      } else {
        alert(result.error || 'Failed to create partner');
      }
    } catch (error) {
      console.error('Error creating partner:', error);
      alert('Failed to create partner');
    }
  };

  // Toggle partner active status
  const togglePartnerStatus = async (partnerId, isActive) => {
    try {
      const response = await adminFetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      const result = await response.json();

      if (result.success) {
        loadPartners(); // Refresh the list
      } else {
        alert(result.error || 'Failed to update partner status');
      }
    } catch (error) {
      console.error('Error updating partner status:', error);
      alert('Failed to update partner status');
    }
  };

  // ========== AMBASSADOR MANAGEMENT FUNCTIONS ==========

  // Load ambassadors
  const loadAmbassadors = async () => {
    setAmbassadorsLoading(true);
    setAmbassadorsError('');
    try {
      const response = await adminFetch('/api/admin/ambassadors');
      const result = await response.json();
      if (result.success) {
        setAmbassadorsData(result.ambassadors || []);
      } else {
        setAmbassadorsError(result.error || 'Failed to load ambassadors');
      }
    } catch (error) {
      console.error('Error loading ambassadors:', error);
      setAmbassadorsError('Failed to load ambassadors');
    } finally {
      setAmbassadorsLoading(false);
    }
  };

  // Add new ambassador
  const handleAddAmbassador = async () => {
    if (!addAmbassadorFid || addAmbassadorFid.trim() === '') {
      alert('Please enter a Farcaster ID');
      return;
    }

    try {
      const response = await adminFetch('/api/admin/ambassadors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: parseInt(addAmbassadorFid),
          notes: addAmbassadorNotes.trim() || null
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`Ambassador added successfully! @${result.ambassador.profiles?.username || addAmbassadorFid}`);
        setShowAddAmbassador(false);
        setAddAmbassadorFid('');
        setAddAmbassadorNotes('');
        loadAmbassadors();
      } else {
        alert(result.error || 'Failed to add ambassador');
      }
    } catch (error) {
      console.error('Error adding ambassador:', error);
      alert('Failed to add ambassador');
    }
  };

  // Toggle ambassador active status
  const toggleAmbassadorStatus = async (ambassadorId, isActive) => {
    try {
      const response = await adminFetch(`/api/admin/ambassadors/${ambassadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });

      const result = await response.json();
      if (result.success) {
        loadAmbassadors();
      } else {
        alert(result.error || 'Failed to update ambassador status');
      }
    } catch (error) {
      console.error('Error updating ambassador status:', error);
      alert('Failed to update ambassador status');
    }
  };

  // Load bounties
  const loadBounties = async () => {
    setBountiesLoading(true);
    setBountiesError('');
    try {
      const response = await adminFetch('/api/admin/bounties');
      const result = await response.json();
      if (result.success) {
        setBountiesData(result.bounties || []);
      } else {
        setBountiesError(result.error || 'Failed to load bounties');
      }
    } catch (error) {
      console.error('Error loading bounties:', error);
      setBountiesError('Failed to load bounties');
    } finally {
      setBountiesLoading(false);
    }
  };

  // Toggle bounty active status
  const toggleBountyStatus = async (bountyId, isActive) => {
    try {
      const response = await adminFetch(`/api/admin/bounties/${bountyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });

      const result = await response.json();
      if (result.success) {
        loadBounties();
      } else {
        alert(result.error || 'Failed to update bounty status');
      }
    } catch (error) {
      console.error('Error updating bounty status:', error);
      alert('Failed to update bounty status');
    }
  };

  // Load submissions
  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    setSubmissionsError('');
    try {
      const url = submissionsFilter === 'all' 
        ? '/api/admin/bounty-submissions'
        : `/api/admin/bounty-submissions?status=${submissionsFilter}`;
      
      const response = await adminFetch(url);
      const result = await response.json();
      if (result.success) {
        setSubmissionsData(result.submissions || []);
      } else {
        setSubmissionsError(result.error || 'Failed to load submissions');
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
      setSubmissionsError('Failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  // Approve submission
  const handleApproveSubmission = async (submissionId, bountyTitle) => {
    if (!confirm(`Approve this submission for "${bountyTitle}"? This will create a payout.`)) {
      return;
    }

    try {
      const response = await adminFetch(`/api/admin/bounty-submissions/${submissionId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: 'Approved' })
      });

      const result = await response.json();
      if (result.success) {
        alert('Submission approved! Payout created.');
        if (result.warning) {
          alert(`Warning: ${result.warning}`);
        }
        loadSubmissions();
        loadPayouts(); // Refresh payouts since we created a new one
      } else {
        alert(result.error || 'Failed to approve submission');
      }
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Failed to approve submission');
    }
  };

  // Reject submission
  const handleRejectSubmission = async (submissionId, bountyTitle) => {
    const reason = prompt(`Reject submission for "${bountyTitle}"?\n\nPlease provide a reason (required):`);
    if (!reason || reason.trim() === '') {
      return;
    }

    try {
      const response = await adminFetch(`/api/admin/bounty-submissions/${submissionId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: reason.trim() })
      });

      const result = await response.json();
      if (result.success) {
        alert('Submission rejected');
        loadSubmissions();
      } else {
        alert(result.error || 'Failed to reject submission');
      }
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Failed to reject submission');
    }
  };

  // Load payouts
  const loadPayouts = async () => {
    setPayoutsLoading(true);
    setPayoutsError('');
    try {
      const url = payoutsFilter === 'all'
        ? '/api/admin/ambassador-payouts'
        : `/api/admin/ambassador-payouts?status=${payoutsFilter}`;
      
      const response = await adminFetch(url);
      const result = await response.json();
      if (result.success) {
        setPayoutsData(result.payouts || []);
      } else {
        setPayoutsError(result.error || 'Failed to load payouts');
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
      setPayoutsError('Failed to load payouts');
    } finally {
      setPayoutsLoading(false);
    }
  };

  // Complete payout (mark as completed with tx hash)
  const handleCompletePayout = async (payoutId, ambassadorUsername, amount) => {
    const txHash = prompt(`Mark payout as completed for @${ambassadorUsername}?\n\nAmount: ${amount} tokens\n\nEnter transaction hash:`);
    if (!txHash || txHash.trim() === '') {
      return;
    }

    try {
      const response = await adminFetch('/api/admin/ambassador-payouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId,
          status: 'completed',
          transactionHash: txHash.trim(),
          notes: 'Completed by admin'
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('Payout marked as completed!');
        loadPayouts();
      } else {
        alert(result.error || 'Failed to complete payout');
      }
    } catch (error) {
      console.error('Error completing payout:', error);
      alert('Failed to complete payout');
    }
  };

  // Load past raffles when Past Raffles tab is selected
  useEffect(() => {
    if (activeTab === 'past-raffles' && pastRaffles.length === 0) {
      loadPastRaffles();
    }
  }, [activeTab]);

  // Load users when Users tab is selected
  useEffect(() => {
    if (activeTab === 'users' && usersData.length === 0) {
      loadUsers();
    }
  }, [activeTab]);

  // Load check-ins when Check-ins tab is selected
  useEffect(() => {
    if (activeTab === 'checkins' && checkinsData.length === 0) {
      loadCheckinsData();
    }
  }, [activeTab]);

  // Load partners when Partners tab is selected
  useEffect(() => {
    if (activeTab === 'partners' && partnersSubTab === 'partners' && partnersData.length === 0) {
      loadPartners();
    }
  }, [activeTab, partnersSubTab]);

  // Load ambassadors when Ambassadors sub-tab is selected
  useEffect(() => {
    if (activeTab === 'partners' && partnersSubTab === 'ambassadors') {
      if (ambassadorView === 'ambassadors' && ambassadorsData.length === 0) {
        loadAmbassadors();
      } else if (ambassadorView === 'bounties' && bountiesData.length === 0) {
        loadBounties();
      } else if (ambassadorView === 'submissions') {
        loadSubmissions();
      } else if (ambassadorView === 'payouts') {
        loadPayouts();
      }
    }
  }, [activeTab, partnersSubTab, ambassadorView, submissionsFilter, payoutsFilter]);

  // Function to reload leaderboard data with current sort
  const reloadLeaderboardData = async (newSortField = sortField) => {
    try {
      const leaderboardRes = await adminFetch(`/api/admin/leaderboard?limit=10000&sortBy=${newSortField}`);
      const leaderboard = await leaderboardRes.json();
      setLeaderboardData(leaderboard.data || []);
    } catch (error) {
      console.error('Failed to reload leaderboard data:', error);
    }
  };

  // Leaderboard sorting function
  const handleSort = async (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
      // Reload data with new sort field to get correct dataset (profiles vs user_leaderboard)
      await reloadLeaderboardData(field);
    }
  };

  // Users sorting function
  const handleUsersSort = (field) => {
    if (usersSortField === field) {
      setUsersSortDirection(usersSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setUsersSortField(field);
      setUsersSortDirection('desc');
    }
  };

  // Orders sorting function
  const handleOrdersSort = (field) => {
    if (ordersSortField === field) {
      setOrdersSortDirection(ordersSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdersSortField(field);
      setOrdersSortDirection('desc');
    }
  };

  // Check-ins sorting function
  const handleCheckinsSort = (field) => {
    if (checkinsSortField === field) {
      setCheckinsSortDirection(checkinsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCheckinsSortField(field);
      setCheckinsSortDirection('desc');
    }
  };

  // Get sorted leaderboard data
  const getSortedLeaderboard = () => {
    if (!leaderboardData) return [];
    
    return [...leaderboardData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle null/undefined values - put them at the end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = typeof bVal === 'string' ? bVal.toLowerCase() : '';
      }
      
      // Handle numeric fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (sortDirection === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      }
      
      // Handle string comparison
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Get sorted users data
  const getSortedUsers = () => {
    if (!usersData) return [];
    
    return [...usersData].sort((a, b) => {
      let aVal = a[usersSortField];
      let bVal = b[usersSortField];
      
      // Handle null/undefined values - put them at the end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = typeof bVal === 'string' ? bVal.toLowerCase() : '';
      }
      
      // Handle numeric fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (usersSortDirection === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      }
      
      // Handle date fields
      if (usersSortField === 'updated_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
        return usersSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string comparison
      if (usersSortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Get sorted orders data
  const getSortedOrders = () => {
    if (!ordersData) return [];
    
    return [...ordersData].sort((a, b) => {
      let aVal = a[ordersSortField];
      let bVal = b[ordersSortField];
      
      // Handle null/undefined values - put them at the end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = typeof bVal === 'string' ? bVal.toLowerCase() : '';
      }
      
      // Handle numeric fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (ordersSortDirection === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      }
      
      // Handle date fields
      if (ordersSortField === 'created_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
        return ordersSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string comparison
      if (ordersSortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Discount sorting and filtering functions
  const handleDiscountSort = (field) => {
    if (discountSortField === field) {
      setDiscountSortDirection(discountSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDiscountSortField(field);
      setDiscountSortDirection('desc');
    }
  };

  const getFilteredAndSortedDiscounts = () => {
    // Server-side filtering and pagination is now handled in the API
    // This function just returns the current page data
    return discountsData || [];
  };

  const exportData = (data, filename) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Helper functions for winner display
  const getWinnerDisplayName = (winner) => {
    const profile = winnerProfiles[winner.user_fid];
    return profile?.display_name || profile?.username || winner.username || `FID ${winner.user_fid}`;
  };

  const getWinnerAvatar = (winner) => {
    const profile = winnerProfiles[winner.user_fid];
    if (profile?.avatar_url) {
      return profile.avatar_url;
    }
    // Generate a gradient based on user_fid for consistent fallback
    const hue = (winner.user_fid * 137.508) % 360;
    return `linear-gradient(45deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 60) % 360}, 70%, 70%))`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount) || 0); // Amounts are already in dollars
  };

  // Copy to clipboard function
  const copyToClipboard = async (text, buttonId = null) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied to clipboard:', text);
      
      // Add visual feedback if buttonId is provided
      if (buttonId) {
        setCopiedButtons(prev => new Set(prev).add(buttonId));
        setTimeout(() => {
          setCopiedButtons(prev => {
            const newSet = new Set(prev);
            newSet.delete(buttonId);
            return newSet;
          });
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Manual notification triggers
  const handleManualNotification = async (type) => {
    setNotificationLoading(true);
    setNotificationResult(null);
    
    try {
      const endpoint = type === 'daily' 
        ? '/api/notifications/daily-checkin'
        : '/api/notifications/evening-checkin';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Force-Run': 'true'
        },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setNotificationResult({
          success: true,
          type,
          message: result.message,
          stats: result.stats
        });
      } else {
        setNotificationResult({
          success: false,
          type,
          message: result.error || 'Failed to send notifications'
        });
      }
    } catch (error) {
      console.error('Error sending manual notification:', error);
      setNotificationResult({
        success: false,
        type,
        message: 'Network error occurred'
      });
    } finally {
      setNotificationLoading(false);
      setShowNotificationConfirm(null);
    }
  };

  const confirmNotification = (type) => {
    setShowNotificationConfirm(type);
  };

  // Sync products from Shopify
  const syncProducts = async () => {
    setProductsSyncLoading(true);
    try {
      console.log('🔄 Starting product sync...');
      
      const response = await fetch('/api/products/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_all',
          force: false
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Product sync completed:', result);
        
        // Refresh the products data
        const productsResponse = await fetch('/api/products');
        const productsData = await productsResponse.json();
        setProductsData(productsData.products || []);
        
        // Could add a toast notification here
        alert(`Product sync completed! ${result.synced_count || 0} products synced, ${result.updated_count || 0} updated.`);
      } else {
        console.error('❌ Product sync failed:', result.error);
        alert(`Product sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error syncing products:', error);
      alert('Product sync failed. Please try again.');
    } finally {
      setProductsSyncLoading(false);
    }
  };

  // Sync collections from Shopify
  const syncCollections = async () => {
    setCollectionsLoading(true);
    try {
      console.log('🔄 Starting collections sync...');
      
      const response = await fetch('/api/shopify/collections');
      
      if (response.ok) {
        const collections = await response.json();
        setCollectionsData(collections || []);
        console.log('✅ Collections sync completed:', collections.length, 'collections loaded');
        alert(`Collections sync completed! ${collections.length} collections loaded.`);
      } else {
        console.error('❌ Collections sync failed');
        alert('Collections sync failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error syncing collections:', error);
      alert('Collections sync failed. Please try again.');
    } finally {
      setCollectionsLoading(false);
    }
  };

  // Helper functions for discount display
  const getDiscountFids = (discount) => {
    // Read from the single fid column, not whitelisted_fids array
    if (!discount.fid) return null;
    return discount.fid.toString();
  };

  const getDiscountProducts = (discount) => {
    // Parse target_products JSONB field
    let targetProducts = [];
    if (discount.target_products) {
      try {
        if (typeof discount.target_products === 'string') {
          targetProducts = JSON.parse(discount.target_products);
        } else if (Array.isArray(discount.target_products)) {
          targetProducts = discount.target_products;
        }
      } catch (e) {
        console.error('Error parsing target_products:', e);
        return null;
      }
    }
    
    if (!targetProducts || targetProducts.length === 0) return null;
    
    const productTitles = targetProducts.map(productHandle => {
      const product = productsData.find(p => p.handle === productHandle);
      return product ? product.title : productHandle;
    });
    
    return productTitles.join(', ');
  };

  const handleEditDiscount = (discount) => {
    setEditingDiscount(discount);
    setShowEditDiscount(true);
  };

  const handleDeleteDiscount = async (discountId) => {
    if (!confirm('Are you sure you want to delete this discount code?')) return;
    
    try {
      const response = await adminFetch(`/api/admin/discounts/${discountId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Reload current page of discounts
        await loadDiscounts(discountPagination.page, discountPagination.limit);
      } else {
        alert('Failed to delete discount');
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      alert('Failed to delete discount');
    }
  };

  // Get sorted check-ins data
  const getSortedCheckinsData = () => {
    if (!checkinsData) return [];
    
    return [...checkinsData].sort((a, b) => {
      let aVal = a[checkinsSortField];
      let bVal = b[checkinsSortField];
      
      // Handle null/undefined values - put them at the end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = typeof bVal === 'string' ? bVal.toLowerCase() : '';
      }
      
      // Handle numeric fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (checkinsSortDirection === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      }
      
      // Handle date fields
      if (checkinsSortField === 'created_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
        return checkinsSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string comparison
      if (checkinsSortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <img 
              src="/MintedMerchSpinnerLogo.png" 
              alt="Minted Merch"
              className="h-12 w-auto mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-800">
              Admin Dashboard
            </h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder="Enter admin password"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3eb489] hover:bg-[#359970] text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="/MintedMerchSpinnerLogo.png" 
                alt="Minted Merch"
                className="h-8 w-auto"
              />
              <h1 className="text-xl font-semibold text-gray-800">
                Mini App Dashboard
              </h1>
            </div>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'dashboard', label: '📊 Dashboard' },
                { key: 'chat', label: '💬 Chat' },
                { key: 'users', label: '👥 Users' },
                { key: 'orders', label: '🛍️ Orders' },
                { key: 'partners', label: '🤝 Partners' },
                { key: 'discounts', label: '🎫 Discounts' },
                { key: 'leaderboard', label: '🏆 Leaderboard' },
                { key: 'checkins', label: '📅 Check-ins' },
                { key: 'raffle', label: '🎲 Raffle Tool' },
                { key: 'past-raffles', label: '📚 Past Raffles' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-[#3eb489] text-[#3eb489]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">📊 Dashboard</h2>
                <div className="flex items-center space-x-4">
                  {/* Merch Moguls Stat */}
                  {dashboardStats && (
                    <div className="flex items-center bg-purple-100 px-3 py-2 rounded-md">
                      <span className="text-purple-600 font-medium text-sm">
                        💎 Merch Moguls: <span className="font-bold">{dashboardStats.merchMoguls || 0}</span>
                      </span>
                    </div>
                  )}
                  
                  {/* Holders of 1M+ Stat */}
                  {dashboardStats && (
                    <div className="flex items-center bg-blue-100 px-3 py-2 rounded-md">
                      <span className="text-blue-600 font-medium text-sm">
                        🏆 Holders of 1M+: <span className="font-bold">{dashboardStats.holdersOneMillion || 0}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/`, 'main-page-url')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
                    >
                      {copiedButtons.has('main-page-url') ? '✅ Copied!' : '🔗 Copy Main Page URL'}
                    </button>
                    <button
                      onClick={loadDashboardData}
                      className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {dashboardStats && [
                { label: 'Total Users', value: dashboardStats.totalUsers, icon: '👥' },
                { label: 'Users on Leaderboard', value: dashboardStats.usersOnLeaderboard, icon: '🏆' },
                { label: 'Active Streaks', value: dashboardStats.activeStreaks, icon: '🔥' },
                { label: 'Check-Ins Today', value: dashboardStats.checkInsToday, icon: '📅' },
                { label: 'Users with Notifications', value: dashboardStats.usersWithNotifications, icon: '🔔' },
                { label: 'Total Points Awarded', value: dashboardStats.totalPoints?.toLocaleString(), icon: '⭐' },
                { label: 'Discounts Used', value: dashboardStats.discountsUsed, icon: '🎫' },
                { label: 'Total Orders', value: dashboardStats.totalOrders, icon: '🛍️' },
                { label: 'Wallets Staked', value: dashboardStats.walletsStaked, icon: '🔒' },
                { label: '$MINTEDMERCH Staked', value: formatTokenBalance(dashboardStats.totalStaked), icon: '📊' },
                { label: 'Pending Bounty Submissions', value: dashboardStats.pendingSubmissions, icon: '📝' }
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">{stat.icon}</div>
                    <div>
                      <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
                      <div className="text-sm text-gray-600">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Last Raffle Info */}
            {dashboardStats?.lastRaffle && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🎲 Last Raffle</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Date</div>
                    <div className="font-medium">{formatDate(dashboardStats.lastRaffle.date)}</div>
                    
                    <div className="text-sm text-gray-600 mb-2 mt-4">Criteria</div>
                    <div className="font-medium">{dashboardStats.lastRaffle.criteria}</div>
                    
                    <div className="text-sm text-gray-600 mb-2 mt-4">Results</div>
                    <div className="font-medium">
                      {dashboardStats.lastRaffle.totalWinners} winner{dashboardStats.lastRaffle.totalWinners > 1 ? 's' : ''} from {dashboardStats.lastRaffle.totalEligible} eligible users
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Winners</div>
                    <div className="space-y-2">
                      {dashboardStats.lastRaffle.winners.map((winner) => (
                        <div key={winner.fid} className="flex items-center space-x-2">
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                            #{winner.position}
                          </span>
                          <span className="font-medium text-blue-600">
                            @{winner.username}
                          </span>
                          <span className="text-xs text-gray-500">
                            (FID: {winner.fid})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Products Section */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">🛍️ Products</h3>
                <button
                  onClick={syncProducts}
                  disabled={productsSyncLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {productsSyncLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>Sync from Shopify</span>
                    </>
                  )}
                </button>
              </div>
              {productsData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📦</div>
                  <div className="text-gray-500">No products found</div>
                  <p className="text-sm text-gray-400 mt-2">Click "Sync from Shopify" to load products</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {productsData.map((product) => (
                    <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center mb-3">
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.title}
                            className="w-12 h-12 object-cover rounded-lg mr-3"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{product.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {product.price_min === product.price_max 
                              ? `$${product.price_min}` 
                              : `$${product.price_min} - $${product.price_max}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/product/${product.handle}`, `product-${product.id}`)}
                        className="w-full bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        {copiedButtons.has(`product-${product.id}`) ? '✅ Copied!' : '📋 Copy Product URL'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Collections Section */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">📁 Collections</h3>
                <button
                  onClick={syncCollections}
                  disabled={collectionsLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {collectionsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>Sync from Shopify</span>
                    </>
                  )}
                </button>
              </div>
              {collectionsData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📁</div>
                  <div className="text-gray-500">No collections found</div>
                  <p className="text-sm text-gray-400 mt-2">Click "Sync from Shopify" to load collections</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {collectionsData.map((collection) => (
                    <div key={collection.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center mb-3">
                        {collection.image?.url && (
                          <img 
                            src={collection.image.url} 
                            alt={collection.image.altText || collection.title}
                            className="w-12 h-12 object-cover rounded-lg mr-3"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{collection.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Handle: {collection.handle}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/?collection=${collection.handle}`, `collection-${collection.id}`)}
                        className="w-full bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        {copiedButtons.has(`collection-${collection.id}`) ? '✅ Copied!' : '📋 Copy Collection URL'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">👥 Users</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => exportData(usersData, `users_${new Date().toISOString().split('T')[0]}.csv`)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={loadUsers}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            {usersLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading users...</p>
              </div>
            ) : usersError ? (
              <div className="p-6 text-center">
                <div className="text-red-500 mb-4">❌ {usersError}</div>
                <button
                  onClick={loadUsers}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Try Again
                </button>
              </div>
            ) : usersData.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">👥</div>
                <div className="text-gray-500">No users found</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('display_name')}
                      >
                        User {usersSortField === 'display_name' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('fid')}
                      >
                        FID {usersSortField === 'fid' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('has_notifications')}
                      >
                        Notifications {usersSortField === 'has_notifications' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('x_username')}
                      >
                        X Username {usersSortField === 'x_username' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('token_balance')}
                      >
                        Token Holdings {usersSortField === 'token_balance' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('bankr_club_member')}
                      >
                        Bankr Club {usersSortField === 'bankr_club_member' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('email')}
                      >
                        Email {usersSortField === 'email' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('total_orders')}
                      >
                        Orders {usersSortField === 'total_orders' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('total_spent')}
                      >
                        Total Spent {usersSortField === 'total_spent' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('updated_at')}
                      >
                        Last Active {usersSortField === 'updated_at' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSortedUsers().map((user) => (
                      <tr key={user.fid}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div 
                              className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#3eb489] transition-all"
                              onClick={() => openUserModal(user.fid)}
                            >
                              {user.pfp_url ? (
                                <img 
                                  src={user.pfp_url} 
                                  alt={`${user.display_name || user.username || 'User'} profile`}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <span 
                                className="text-sm font-medium text-gray-700 flex items-center justify-center h-full w-full"
                                style={{ display: user.pfp_url ? 'none' : 'flex' }}
                              >
                                {user.display_name?.[0] || user.username?.[0] || '?'}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div 
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                                onClick={() => openUserModal(user.fid)}
                              >
                                {user.display_name || user.username || 'Unknown'}
                              </div>
                              <div 
                                className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                                onClick={() => openUserModal(user.fid)}
                              >
                                @{user.username || 'unknown'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {user.fid}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.has_notifications ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ✗ Disabled
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.x_username ? (
                            <span className="text-blue-600">@{user.x_username}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium text-yellow-600">
                            {formatTokenBalance(user.token_balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.bankr_club_member ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              ✓ Member
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ✗ Not Member
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.email ? (
                            <span className="text-green-600">{user.email}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{user.total_orders || 0}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">${user.total_spent || '0.00'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.updated_at ? formatDate(user.updated_at) : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">User Leaderboard</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => exportData(leaderboardData, 'leaderboard.csv')}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={loadDashboardData}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('user_fid')}
                    >
                      FID {sortField === 'user_fid' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('username')}
                    >
                      User {sortField === 'username' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_points')}
                    >
                      Total Points {sortField === 'total_points' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('checkin_streak')}
                    >
                      Streak {sortField === 'checkin_streak' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('points_from_purchases')}
                    >
                      Purchase Points {sortField === 'points_from_purchases' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('token_balance')}
                    >
                      Total Holdings {sortField === 'token_balance' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staked Balance
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_orders')}
                    >
                      Orders {sortField === 'total_orders' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSortedLeaderboard().map((user, index) => (
                    <tr key={user.user_fid} className={index < 3 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                        {index === 0 && ' 🥇'}
                        {index === 1 && ' 🥈'}
                        {index === 2 && ' 🥉'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {user.user_fid}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3 cursor-pointer hover:ring-2 hover:ring-[#3eb489] transition-all"
                            onClick={() => openUserModal(user.user_fid)}
                          >
                            {user.pfp_url ? (
                              <img 
                                src={user.pfp_url} 
                                alt={`${user.display_name || user.username || 'User'} profile`}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <span 
                              className="text-xs font-medium text-gray-700 flex items-center justify-center h-full w-full"
                              style={{ display: user.pfp_url ? 'none' : 'flex' }}
                            >
                              {user.display_name?.[0] || user.username?.[0] || '?'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <div 
                              className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                              onClick={() => openUserModal(user.user_fid)}
                            >
                              {user.display_name || user.username || 'Unknown'}
                            </div>
                            <div 
                              className="text-gray-500 hover:text-gray-700 cursor-pointer"
                              onClick={() => openUserModal(user.user_fid)}
                            >
                              @{user.username || 'unknown'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.total_points?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.checkin_streak}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.points_from_purchases || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-bold text-yellow-600">
                          {formatTokenBalance(user.token_balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="font-medium text-green-600">
                          {formatTokenBalance(user.wallet_balance || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="font-medium text-purple-600">
                          {formatTokenBalance(user.staked_balance || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.total_orders || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-6">
                <h2 className="text-lg font-semibold text-gray-800">All Orders</h2>
                {dashboardStats && (
                  <div className="flex items-center bg-green-50 px-3 py-1 rounded-md">
                    <span className="text-xl mr-2">💰</span>
                    <div>
                      <div className="text-lg font-bold text-green-700">
                        ${dashboardStats.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </div>
                      <div className="text-xs text-green-600">Total Revenue</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => exportData(ordersData, `orders_${new Date().toISOString().split('T')[0]}.csv`)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={loadDashboardData}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('order_id')}
                    >
                      Order ID {ordersSortField === 'order_id' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('fid')}
                    >
                      FID {ordersSortField === 'fid' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('username')}
                    >
                      Username {ordersSortField === 'username' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('customer_name')}
                    >
                      Customer {ordersSortField === 'customer_name' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Shipping Address
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('status')}
                    >
                      Status {ordersSortField === 'status' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Assigned Partner
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('shipped_at')}
                    >
                      Tracking {ordersSortField === 'shipped_at' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Notifications
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('item_count')}
                    >
                      Items {ordersSortField === 'item_count' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Products
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('amount_total')}
                    >
                      Total {ordersSortField === 'amount_total' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('discount_amount')}
                    >
                      Discount {ordersSortField === 'discount_amount' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('created_at')}
                    >
                      Date {ordersSortField === 'created_at' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSortedOrders().map((order) => (
                    <tr key={order.order_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.order_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.fid}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div 
                            className="flex-shrink-0 h-8 w-8 mr-3 cursor-pointer"
                            onClick={() => openUserModal(order.fid)}
                          >
                            {order.pfp_url ? (
                              <img 
                                src={order.pfp_url} 
                                alt={order.username || 'User'} 
                                className="h-8 w-8 rounded-full object-cover hover:ring-2 hover:ring-[#3eb489] transition-all"
                              />
                            ) : (
                              <div 
                                className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium hover:bg-gray-500 transition-colors"
                                style={{ display: order.pfp_url ? 'none' : 'flex' }}
                              >
                                {order.username?.charAt(0).toUpperCase() || order.fid?.toString().charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          <div>
                            <div 
                              className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                              onClick={() => openUserModal(order.fid)}
                            >
                              {order.username || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{order.customer_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{order.customer_email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs">
                          {order.shipping_address ? (
                            <div className="text-xs space-y-1">
                              <div className="font-medium">
                                {order.shipping_address.firstName} {order.shipping_address.lastName}
                              </div>
                              <div>{order.shipping_address.address1}</div>
                              {order.shipping_address.address2 && (
                                <div>{order.shipping_address.address2}</div>
                              )}
                              <div>
                                {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}
                              </div>
                              <div className="text-gray-500">{order.shipping_address.country}</div>
                              {order.shipping_address.phone && (
                                <div className="text-gray-500">{order.shipping_address.phone}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No shipping address</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'assigned' ? 'bg-orange-100 text-orange-800' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'vendor_paid' ? 'bg-teal-100 text-teal-800' :
                          order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status === 'vendor_paid' ? 'Vendor Paid' : order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.assigned_partner ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <div>
                              <div className="font-medium text-xs">{order.assigned_partner.name}</div>
                              <div className="text-xs text-gray-500">{order.assigned_partner.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {order.tracking_number ? (
                            <div className="text-xs">
                              <div className="font-medium">
                                {order.tracking_url ? (
                                  <a 
                                    href={order.tracking_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {order.tracking_number}
                                  </a>
                                ) : (
                                  <span>{order.tracking_number}</span>
                                )}
                              </div>
                              {order.carrier && (
                                <div className="text-gray-500">{order.carrier}</div>
                              )}
                              {order.shipped_at && (
                                <div className="text-gray-500">
                                  Shipped: {formatDate(order.shipped_at)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No tracking</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          <div className="text-xs">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              order.order_confirmation_sent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {order.order_confirmation_sent ? '✅' : '❌'} Order Confirmation
                            </div>
                            {order.order_confirmation_sent_at && (
                              <div className="text-gray-500 mt-1">
                                {formatDate(order.order_confirmation_sent_at)}
                              </div>
                            )}
                          </div>
                          <div className="text-xs">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              order.shipping_notification_sent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {order.shipping_notification_sent ? '✅' : '❌'} Shipping Notification
                            </div>
                            {order.shipping_notification_sent_at && (
                              <div className="text-gray-500 mt-1">
                                {formatDate(order.shipping_notification_sent_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.item_count}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {order.products && order.products.length > 0 ? (
                            order.products.map((product, index) => (
                              <div key={index} className="flex items-center">
                                {product.image && (
                                  <img 
                                    src={product.image} 
                                    alt={product.title} 
                                    className="h-8 w-8 rounded mr-2 object-cover"
                                  />
                                )}
                                <div>
                                  <div className="font-medium text-xs">{product.title}</div>
                                  <div className="text-xs text-gray-500">
                                    {product.variant !== 'Default' && product.variant} • Qty: {product.quantity}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">No products</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.amount_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.discount_applied ? (
                          <div>
                            <div className="font-medium">{order.discount_code}</div>
                            <div className="text-xs text-gray-500">{formatCurrency(order.discount_amount)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => openOrderEditModal(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Discounts Tab */}
        {activeTab === 'discounts' && (
          <div className="space-y-6">
            {/* Discounts Header */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">🎫 Discount Codes</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportData(getFilteredAndSortedDiscounts(), 'discounts.csv')}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={() => loadDiscounts(discountPagination.page, discountPagination.limit)}
                    className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => setShowCreateDiscount(true)}
                    className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                  >
                    ➕ Create New Discount
                  </button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <input
                    type="text"
                    placeholder="Search codes..."
                    value={discountFilters.searchTerm}
                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  />
                  <select
                    value={discountFilters.gatingType}
                    onChange={(e) => handleFilterChange('gatingType', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  >
                    <option value="all">All Gating Types</option>
                    <option value="none">Public</option>
                    <option value="whitelist_fid">FID Whitelist</option>
                    <option value="whitelist_wallet">Wallet Whitelist</option>
                    <option value="nft_holding">NFT Holders</option>
                    <option value="token_balance">Token Balance</option>
                    <option value="bankr_club">Bankr Club</option>
                  </select>
                  <select
                    value={discountFilters.codeType}
                    onChange={(e) => handleFilterChange('codeType', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  >
                    <option value="all">All Code Types</option>
                    <option value="welcome">Welcome</option>
                    <option value="promotional">Promotional</option>
                    <option value="referral">Referral</option>
                  </select>
                  <select
                    value={discountFilters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={discountFilters.discountScope}
                    onChange={(e) => handleFilterChange('discountScope', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  >
                    <option value="all">All Scopes</option>
                    <option value="site_wide">Site Wide</option>
                    <option value="product">Product Specific</option>
                  </select>
                </div>
              </div>
              
              {/* Discounts Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('code')}
                      >
                        Code
                        {discountSortField === 'code' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('discount_type')}
                      >
                        Type
                        {discountSortField === 'discount_type' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('discount_value')}
                      >
                        Value
                        {discountSortField === 'discount_value' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('gating_type')}
                      >
                        Gating
                        {discountSortField === 'gating_type' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        FID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('usage_count')}
                      >
                        Usage
                        {discountSortField === 'usage_count' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('is_active')}
                      >
                        Status
                        {discountSortField === 'is_active' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleDiscountSort('expires_at')}
                      >
                        Expires
                        {discountSortField === 'expires_at' && (
                          <span className="ml-1">{discountSortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAndSortedDiscounts().map((discount) => (
                      <tr key={discount.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {discount.code}
                          {discount.free_shipping && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">�� Free Ship</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.discount_type === 'percentage' ? `${discount.discount_value}%` : `$${discount.discount_value}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded ${
                            discount.code_type === 'welcome' ? 'bg-green-100 text-green-800' :
                            discount.code_type === 'promotional' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {discount.code_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded ${
                            discount.gating_type === 'none' ? 'bg-gray-100 text-gray-800' :
                            discount.gating_type === 'bankr_club' ? 'bg-purple-100 text-purple-800' :
                            discount.gating_type === 'whitelist_fid' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {discount.gating_type === 'none' ? 'Public' :
                             discount.gating_type === 'bankr_club' ? 'Bankr Club' :
                             discount.gating_type === 'whitelist_fid' ? 'FID Whitelist' :
                             discount.gating_type === 'whitelist_wallet' ? 'Wallet Whitelist' :
                             discount.gating_type === 'nft_holding' ? 'NFT Holders' :
                             discount.gating_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.fid || (discount.gating_type === 'whitelist_fid' && discount.whitelisted_fids?.length > 0) ? (
                            <span className="text-xs bg-yellow-50 border border-yellow-200 px-2 py-1 rounded">
                              {discount.fid ? `FID: ${discount.fid}` : 
                               (discount.whitelisted_fids?.length > 0 ? `${discount.whitelisted_fids.length} FIDs` : 'No FIDs')}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.discount_scope === 'product' ? (
                            <span className="text-xs bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                              {getDiscountProducts(discount) || 'No Products'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.usage_count} / {discount.max_uses_total || '∞'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded ${
                            discount.is_active ? 'bg-green-100 text-green-800' :
                            discount.is_expired ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {discount.is_active ? 'Active' :
                             discount.is_expired ? 'Expired' :
                             'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.expires_at ? formatDate(discount.expires_at) : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => handleEditDiscount(discount)}
                            className="text-blue-600 hover:text-blue-900 text-xs mr-2"
                            title="Edit Discount"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteDiscount(discount.id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                            title="Delete Discount"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => loadDiscounts(discountPagination.page - 1, discountPagination.limit)}
                    disabled={!discountPagination.hasPrev}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => loadDiscounts(discountPagination.page + 1, discountPagination.limit)}
                    disabled={!discountPagination.hasNext}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{((discountPagination.page - 1) * discountPagination.limit) + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(discountPagination.page * discountPagination.limit, discountPagination.total)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{discountPagination.total}</span> discount codes
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => loadDiscounts(discountPagination.page - 1, discountPagination.limit)}
                        disabled={!discountPagination.hasPrev}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        ←
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(discountPagination.totalPages, 7) }, (_, i) => {
                        let pageNum;
                        if (discountPagination.totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (discountPagination.page <= 4) {
                          pageNum = i + 1;
                        } else if (discountPagination.page >= discountPagination.totalPages - 3) {
                          pageNum = discountPagination.totalPages - 6 + i;
                        } else {
                          pageNum = discountPagination.page - 3 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => loadDiscounts(pageNum, discountPagination.limit)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              pageNum === discountPagination.page
                                ? 'z-10 bg-[#3eb489] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3eb489]'
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => loadDiscounts(discountPagination.page + 1, discountPagination.limit)}
                        disabled={!discountPagination.hasNext}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        →
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </div>

            {/* Create Discount Modal */}
            {showCreateDiscount && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Create New Discount Code</h3>
                    <button
                      onClick={() => setShowCreateDiscount(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                                     <CreateDiscountForm 
                      onClose={() => setShowCreateDiscount(false)} 
                      onSuccess={() => loadDiscounts(discountPagination.page, discountPagination.limit)} 
                    />
                </div>
              </div>
            )}

            {/* Edit Discount Modal */}
            {showEditDiscount && editingDiscount && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Edit Discount Code</h3>
                    <button
                      onClick={() => setShowEditDiscount(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                                      <EditDiscountForm 
                      discount={editingDiscount} 
                      onClose={() => setShowEditDiscount(false)} 
                      onSuccess={() => loadDiscounts(discountPagination.page, discountPagination.limit)} 
                    />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check-ins Tab */}
        {activeTab === 'checkins' && (
          <div className="space-y-6">
            {/* Manual Notification Triggers */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">🔔 Manual Notification Triggers</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Send check-in reminder notifications manually. Use with caution - these will send to all eligible users.
                </p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Daily Check-in Notifications */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <span className="text-xl">🌅</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Daily Check-in Reminder</h4>
                        <p className="text-xs text-gray-600">Normally sent at 8 AM PST</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      Reminds users to check in and earn their daily points.
                    </p>
                    <button
                      onClick={() => confirmNotification('daily')}
                      disabled={notificationLoading}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      {notificationLoading ? 'Sending...' : 'Send Daily Reminder'}
                    </button>
                  </div>

                  {/* Evening Check-in Notifications */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <div className="bg-purple-100 p-2 rounded-lg mr-3">
                        <span className="text-xl">🌙</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Evening Check-in Reminder</h4>
                        <p className="text-xs text-gray-600">Normally sent at 8 PM PST</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      Reminds users to complete their evening check-in.
                    </p>
                    <button
                      onClick={() => confirmNotification('evening')}
                      disabled={notificationLoading}
                      className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      {notificationLoading ? 'Sending...' : 'Send Evening Reminder'}
                    </button>
                  </div>
                </div>

                {/* Notification Result */}
                {notificationResult && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    notificationResult.success 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center">
                      <span className="text-xl mr-3">
                        {notificationResult.success ? '✅' : '❌'}
                      </span>
                      <div>
                        <h4 className={`font-semibold ${
                          notificationResult.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {notificationResult.success ? 'Success!' : 'Error'}
                        </h4>
                        <p className={`text-sm ${
                          notificationResult.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {notificationResult.message}
                        </p>
                        {notificationResult.success && notificationResult.stats && (
                          <p className="text-sm text-green-600 mt-1">
                            Sent to {notificationResult.stats.successCount} users
                            {notificationResult.stats.failureCount > 0 && 
                              ` (${notificationResult.stats.failureCount} failed)`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Tools */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">🔧 Admin Tools</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Emergency tools for fixing edge cases and system issues
                </p>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Daily Spin Reset Tool */}
                <div className="border border-yellow-200 rounded-lg p-6 bg-yellow-50">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h4 className="text-sm font-medium text-yellow-800">
                        ⚠️ Manual Daily Check-In Tool
                      </h4>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          <strong>Use Case:</strong> When a user gets "Already spun this app-day" error but has no database record since the daily reset.
                        </p>
                        <p className="mt-1">
                          <strong>What it does:</strong> Performs a complete daily check-in with proper points, streak continuation, and leaderboard updates.
                        </p>
                      </div>
                      
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="resetSpinFid" className="block text-sm font-medium text-gray-700">
                            User FID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            id="resetSpinFid"
                            value={resetSpinFid}
                            onChange={(e) => setResetSpinFid(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#3eb489] focus:border-[#3eb489] sm:text-sm"
                            placeholder="e.g. 458045"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="resetSpinReason" className="block text-sm font-medium text-gray-700">
                            Reason
                          </label>
                          <input
                            type="text"
                            id="resetSpinReason"
                            value={resetSpinReason}
                            onChange={(e) => setResetSpinReason(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#3eb489] focus:border-[#3eb489] sm:text-sm"
                            placeholder="State mismatch between contract and database"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="resetSpinNote" className="block text-sm font-medium text-gray-700">
                            Admin Note
                          </label>
                          <textarea
                            id="resetSpinNote"
                            rows={2}
                            value={resetSpinNote}
                            onChange={(e) => setResetSpinNote(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#3eb489] focus:border-[#3eb489] sm:text-sm"
                            placeholder="Additional context about why this reset was needed..."
                          />
                        </div>
                        
                        <button
                          onClick={handleResetDailySpin}
                          disabled={resetSpinLoading || !resetSpinFid.trim()}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resetSpinLoading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            '✅ Complete Daily Check-In'
                          )}
                        </button>
                      </div>
                      
                      {/* Result Display */}
                      {resetSpinResult && (
                        <div className={`mt-4 p-3 rounded-md ${
                          resetSpinResult.success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="flex">
                            <div className="flex-shrink-0">
                              {resetSpinResult.success ? (
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="ml-3">
                              <h4 className={`text-sm font-medium ${
                                resetSpinResult.success ? 'text-green-800' : 'text-red-800'
                              }`}>
                                {resetSpinResult.success ? '✅ Check-In Completed' : '❌ Check-In Failed'}
                              </h4>
                              <div className={`mt-1 text-sm ${
                                resetSpinResult.success ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {resetSpinResult.success ? (
                                  <div>
                                    <p>{resetSpinResult.message}</p>
                                    {resetSpinResult.data && (
                                      <div className="mt-2 space-y-1">
                                        {resetSpinResult.data.pointsEarned !== undefined && (
                                          <>
                                            <p><strong>Points Earned:</strong> {resetSpinResult.data.pointsEarned}</p>
                                            <p><strong>Current Streak:</strong> {resetSpinResult.data.newStreak} days</p>
                                            <p><strong>Total Points:</strong> {resetSpinResult.data.totalPoints}</p>
                                          </>
                                        )}
                                        {resetSpinResult.data.deletedTransactions !== undefined && (
                                          <p><strong>Records Cleared:</strong> {resetSpinResult.data.totalDeleted} transaction(s)</p>
                                        )}
                                      </div>
                                    )}
                                    {resetSpinResult.data?.note && (
                                      <p className="mt-2 text-sm">{resetSpinResult.data.note}</p>
                                    )}
                                  </div>
                                ) : (
                                  <p>{resetSpinResult.error}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Check-ins Data */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-6">
                  <h2 className="text-lg font-semibold text-gray-800">📅 Check-ins Data</h2>
                  <div className="flex items-center bg-gray-50 px-3 py-1 rounded-md">
                    <span className="text-sm mr-2">⛓️ Contract:</span>
                    <code className="text-xs font-mono text-gray-600 mr-2">
                      {process.env.NEXT_PUBLIC_SPIN_REGISTRY_CONTRACT_ADDRESS || '0xe424E28FCDE2E009701F7d592842C56f7E041a3f'}
                    </code>
                    <button
                      onClick={() => copyToClipboard(
                        process.env.NEXT_PUBLIC_SPIN_REGISTRY_CONTRACT_ADDRESS || '0xe424E28FCDE2E009701F7d592842C56f7E041a3f',
                        'contract-address'
                      )}
                      className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded"
                      title="Copy contract address"
                    >
                      {copiedButtons.has('contract-address') ? '✅' : '📋'}
                    </button>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportData(checkinsData, `checkins_${new Date().toISOString().split('T')[0]}.csv`)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={loadCheckinsData}
                    className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
            
            {checkinsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading check-ins...</p>
              </div>
            ) : checkinsError ? (
              <div className="p-6 text-center">
                <div className="text-red-500 mb-4">❌ {checkinsError}</div>
                <button
                  onClick={loadCheckinsData}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Try Again
                </button>
              </div>
            ) : checkinsData.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">📅</div>
                <div className="text-gray-500">No check-ins found</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleCheckinsSort('user_fid')}
                      >
                        FID {checkinsSortField === 'user_fid' && (checkinsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleCheckinsSort('username')}
                      >
                        User {checkinsSortField === 'username' && (checkinsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleCheckinsSort('points_earned')}
                      >
                        Points {checkinsSortField === 'points_earned' && (checkinsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleCheckinsSort('total_points')}
                      >
                        Total Points {checkinsSortField === 'total_points' && (checkinsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleCheckinsSort('checkin_streak')}
                      >
                        Streak {checkinsSortField === 'checkin_streak' && (checkinsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleCheckinsSort('created_at')}
                      >
                        Date {checkinsSortField === 'created_at' && (checkinsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSortedCheckinsData().map((checkin, index) => (
                      <tr key={`${checkin.user_fid}-${checkin.created_at}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {checkin.user_fid}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div 
                              className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3 cursor-pointer hover:ring-2 hover:ring-[#3eb489] transition-all"
                              onClick={() => openUserModal(checkin.user_fid)}
                            >
                              {checkin.pfp_url ? (
                                <img 
                                  src={checkin.pfp_url} 
                                  alt={`${checkin.display_name || checkin.username || 'User'} profile`}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <span 
                                className="text-xs font-medium text-gray-700 flex items-center justify-center h-full w-full"
                                style={{ display: checkin.pfp_url ? 'none' : 'flex' }}
                              >
                                {checkin.display_name?.[0] || checkin.username?.[0] || '?'}
                              </span>
                            </div>
                            <div className="text-sm">
                              <div 
                                className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                                onClick={() => openUserModal(checkin.user_fid)}
                              >
                                {checkin.display_name || checkin.username || 'Unknown'}
                              </div>
                              <div 
                                className="text-gray-500 hover:text-gray-700 cursor-pointer"
                                onClick={() => openUserModal(checkin.user_fid)}
                              >
                                @{checkin.username || 'unknown'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium text-green-600">
                            +{checkin.points_earned || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium text-blue-600">
                            {checkin.total_points || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium text-orange-600">
                            {checkin.checkin_streak || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(checkin.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Raffle Tab */}
        {activeTab === 'raffle' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">🎲 Raffle Tool</h2>
                <button
                  onClick={loadDashboardData}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Raffle Controls */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">🎲 Raffle Configuration</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ⭐ Minimum Points
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 100 (0 = no minimum)"
                      value={raffleFilters.minPoints}
                      onChange={(e) => setRaffleFilters(prev => ({ ...prev, minPoints: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Filter users by total points earned</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      🔥 Minimum Streak Days
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 7 (0 = no minimum)"
                      value={raffleFilters.minStreak}
                      onChange={(e) => setRaffleFilters(prev => ({ ...prev, minStreak: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Filter users by consecutive check-in days</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      🛍️ Minimum Purchase Points
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 50 (0 = no minimum)"
                      value={raffleFilters.minPurchasePoints}
                      onChange={(e) => setRaffleFilters(prev => ({ ...prev, minPurchasePoints: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Filter users by points from purchases</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      💰 Minimum Token Holdings
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 1000000 (0 = no minimum)"
                      value={raffleFilters.minTokenBalance}
                      onChange={(e) => setRaffleFilters(prev => ({ ...prev, minTokenBalance: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Filter users by $MINTEDMERCH token balance</p>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="excludePrevious"
                      checked={raffleFilters.excludePreviousWinners}
                      onChange={(e) => setRaffleFilters(prev => ({ ...prev, excludePreviousWinners: e.target.checked }))}
                      className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
                    />
                    <label htmlFor="excludePrevious" className="text-sm text-gray-700">
                      🚫 Exclude previous winners
                    </label>
                  </div>
                </div>
                
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🏆 Number of Winners
                    </label>
                    <select
                      value={numWinners}
                      onChange={(e) => setNumWinners(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    >
                      <option value={1}>1 Winner</option>
                      <option value={2}>2 Winners</option>
                      <option value={3}>3 Winners</option>
                      <option value={4}>4 Winners</option>
                      <option value={5}>5 Winners</option>
                      <option value={6}>6 Winners</option>
                      <option value={7}>7 Winners</option>
                      <option value={8}>8 Winners</option>
                      <option value={9}>9 Winners</option>
                      <option value={10}>10 Winners</option>
                    </select>
                  </div>

                  <button
                    onClick={() => runRaffle()}
                    className="w-full bg-gradient-to-r from-[#3eb489] to-[#45c497] hover:from-[#359970] hover:to-[#3eb489] text-white py-3 px-4 rounded-md transition-all transform hover:scale-105 shadow-lg"
                  >
                    🎲 Run Custom Raffle ({numWinners} Winner{numWinners > 1 ? 's' : ''})
                  </button>

                  {/* Quick Top Users Raffles */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ Quick Top Users Raffles</h3>
                    
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600 mb-2">🏅 By Total Points</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => runTopUsersRaffle(10, 'total_points')}
                          className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm"
                        >
                          Top 10
                        </button>
                        <button
                          onClick={() => runTopUsersRaffle(20, 'total_points')}
                          className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm"
                        >
                          Top 20
                        </button>
                        <button
                          onClick={() => runTopUsersRaffle(50, 'total_points')}
                          className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm"
                        >
                          Top 50
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 mb-2 mt-3">🔥 By Streak Days</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => runTopUsersRaffle(10, 'checkin_streak')}
                          className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm"
                        >
                          Top 10
                        </button>
                        <button
                          onClick={() => runTopUsersRaffle(20, 'checkin_streak')}
                          className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm"
                        >
                          Top 20
                        </button>
                        <button
                          onClick={() => runTopUsersRaffle(50, 'checkin_streak')}
                          className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm"
                        >
                          Top 50
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 mb-2 mt-3">💰 By Purchase Points</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => runTopUsersRaffle(10, 'points_from_purchases')}
                          className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm"
                        >
                          Top 10
                        </button>
                        <button
                          onClick={() => runTopUsersRaffle(20, 'points_from_purchases')}
                          className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm"
                        >
                          Top 20
                        </button>
                        <button
                          onClick={() => runTopUsersRaffle(50, 'points_from_purchases')}
                          className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm"
                        >
                          Top 50
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <p className="text-xs text-blue-700">
                    💡 <strong>Pro Tip:</strong> Perfect layout for screenshots! Results show user avatars and branding for professional announcements.
                  </p>
                </div>
              </div>

              {/* Raffle Results */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {raffleResults.length > 0 ? (
                  <div>
                    {/* Professional Header with Branding */}
                    <div className="bg-gradient-to-r from-gray-900 to-black p-6 text-white">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center space-x-3">
                          <img 
                            src="/MintedMerchSpinnerLogo.png" 
                            alt="Minted Merch"
                            className="h-8 w-auto"
                          />
                          <h2 className="text-xl font-bold">Raffle Winners!</h2>
                        </div>
                      </div>
                      <div className="text-center text-sm opacity-90 mt-2">
                        {raffleResults.length} raffle{raffleResults.length > 1 ? 's' : ''} completed
                      </div>
                    </div>
                    
                    {/* Multiple Raffle Results */}
                    <div className="p-6 space-y-6">
                      {raffleResults.map((raffle, raffleIndex) => (
                        <div key={raffleIndex} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                          {/* Raffle Header */}
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="bg-[#3eb489] text-white px-2 py-1 rounded text-xs font-medium">
                                  Raffle #{raffleIndex + 1}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {new Date(raffle.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {raffle.winners.length} winner{raffle.winners.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700 mt-1">
                              {raffle.criteriaDescription}
                            </div>
                          </div>
                          
                          {/* Winners for this raffle */}
                          <div className="p-4 space-y-3">
                            {raffle.winners.map((winner, winnerIndex) => {
                              const avatar = getWinnerAvatar(winner);
                              const isGradient = avatar.startsWith('linear-gradient');
                              
                              return (
                                <div key={winner.user_fid} className="relative p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                                  {/* Position Badge */}
                                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                                    #{winnerIndex + 1}
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    {/* Avatar */}
                                    <div className="relative">
                                      {isGradient ? (
                                        <div 
                                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                                          style={{ background: avatar }}
                                        >
                                          {getWinnerDisplayName(winner).charAt(0).toUpperCase()}
                                        </div>
                                      ) : (
                                        <img 
                                          src={avatar}
                                          alt={getWinnerDisplayName(winner)}
                                          className="w-12 h-12 rounded-full object-cover shadow-lg border-2 border-white"
                                        />
                                      )}
                                    </div>
                                    
                                    {/* Winner Info */}
                                    <div className="flex-1">
                                      <div className="font-bold text-gray-800">
                                        🎉 {getWinnerDisplayName(winner)}
                                      </div>
                                      <div className="text-xs text-gray-600 mb-1">
                                        @{winner.username || 'unknown'} • FID: {winner.user_fid}
                                      </div>
                                      <div className="flex items-center space-x-3 text-xs">
                                        <span className="flex items-center space-x-1 text-yellow-600">
                                          <span>⭐</span>
                                          <span className="font-medium">{winner.total_points?.toLocaleString()} points</span>
                                        </span>
                                        <span className="flex items-center space-x-1 text-orange-600">
                                          <span>🔥</span>
                                          <span className="font-medium">{winner.checkin_streak} day streak</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Export All Winners Button */}
                    <div className="px-6 pb-6 space-y-3">
                      <button
                        onClick={() => {
                          const allWinners = raffleResults.flatMap((raffle, index) => 
                            raffle.winners.map(winner => ({
                              ...winner,
                              raffle_number: index + 1,
                              raffle_criteria: raffle.criteriaDescription,
                              raffle_timestamp: raffle.timestamp
                            }))
                          );
                          exportData(allWinners, `all_raffle_winners_${new Date().toISOString().split('T')[0]}.csv`);
                        }}
                        className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white py-3 px-4 rounded-md transition-all shadow-lg"
                      >
                        📥 Export All Winners CSV
                      </button>
                      
                      {/* Clear Results Button */}
                      <button
                        onClick={clearRaffleResults}
                        className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-2 px-4 rounded-md transition-all shadow-lg text-sm"
                      >
                        🗑️ Clear Results
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">🏆 Raffle Results</h2>
                    <div className="text-center text-gray-500 py-12">
                      <div className="text-4xl mb-4">🎲</div>
                      <p>Configure your raffle settings and click the button to select random winners!</p>
                      <p className="text-sm mt-2">Results will display with professional styling perfect for announcements.</p>
                      <p className="text-sm mt-1 text-blue-600">💡 Run multiple raffles to see all results in one screenshot!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Past Raffles Tab */}
        {activeTab === 'past-raffles' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">📚 Past Raffles</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => exportData(pastRaffles, `past_raffles_${new Date().toISOString().split('T')[0]}.csv`)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={loadPastRaffles}
                  className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            {pastRafflesLoading ? (
              <div className="p-6 text-center">
                <div className="text-gray-500">Loading past raffles...</div>
              </div>
            ) : pastRafflesError ? (
              <div className="p-6 text-center">
                <div className="text-red-600">{pastRafflesError}</div>
                <button
                  onClick={loadPastRaffles}
                  className="mt-4 bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                >
                  Try Again
                </button>
              </div>
            ) : pastRaffles.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🎲</div>
                <div className="text-gray-500">No past raffles found</div>
                <p className="text-sm mt-2">Past raffles will appear here after you run them from the Raffle Tool</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raffle ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winners & Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eligible Users</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criteria</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pastRaffles.map((raffle) => (
                      <tr key={raffle.raffleId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {raffle.raffleId}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(raffle.timestamp)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="space-y-1">
                            {raffle.winners.map((winner, index) => (
                              <div key={winner.user_fid} className="flex items-center space-x-2">
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                  #{index + 1}
                                </span>
                                <span className="font-medium text-blue-600">
                                  @{winner.username}
                                </span>
                                <span className="text-xs text-gray-500">
                                  (FID: {winner.user_fid})
                                </span>
                                <span className="text-xs text-gray-400">
                                  {winner.total_points}pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {raffle.totalEligibleUsers}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate" title={raffle.criteriaDescription}>
                          {raffle.criteriaDescription}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => deletePastRaffle(raffle.raffleId)}
                            className="text-red-600 hover:text-red-900 text-xs mr-2"
                            title="Delete Raffle"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Partners Tab */}
        {activeTab === 'partners' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">🤝 Partners & Ambassadors</h2>
              </div>
              
              {/* Sub-tabs */}
              <div className="flex space-x-4 border-b -mb-px">
                <button
                  onClick={() => setPartnersSubTab('partners')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    partnersSubTab === 'partners'
                      ? 'border-[#3eb489] text-[#3eb489]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🤝 Fulfillment Partners
                </button>
                <button
                  onClick={() => {
                    setPartnersSubTab('ambassadors');
                    setAmbassadorView('ambassadors');
                  }}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    partnersSubTab === 'ambassadors'
                      ? 'border-[#3eb489] text-[#3eb489]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🎯 Ambassadors
                </button>
              </div>
            </div>
            
            {/* Fulfillment Partners Content */}
            {partnersSubTab === 'partners' && (
              <>
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-md font-semibold text-gray-700">Fulfillment & Collab Partners</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowCreatePartner(true)}
                      className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                    >
                      ➕ Add Partner
                    </button>
                    <button
                      onClick={loadPartners}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
            
            {partnersLoading ? (
              <div className="p-6 text-center">
                <div className="text-gray-500">Loading partners...</div>
              </div>
            ) : partnersError ? (
              <div className="p-6 text-center">
                <div className="text-red-600">{partnersError}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Partner Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Linked Farcaster
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Statistics
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {partnersData.map((partner) => (
                      <tr key={partner.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                              <div className="text-sm text-gray-500">{partner.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            partner.partner_type === 'collab'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {partner.partner_type === 'collab' ? '🤝 Collab' : '📦 Fulfillment'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {partner.fid ? (
                            <div 
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1"
                              onClick={() => openUserModal(partner.fid)}
                            >
                              {partner.profiles?.pfp_url && (
                                <img
                                  src={partner.profiles.pfp_url}
                                  alt={partner.profiles.username}
                                  className="w-6 h-6 rounded-full"
                                />
                              )}
                              <span className="text-sm text-gray-900 hover:text-blue-600">
                                @{partner.profiles?.username || `FID ${partner.fid}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No FID linked</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {partner.orderStats?.total || 0} Total Orders
                            </div>
                            <div className="flex space-x-4 text-xs text-gray-500 mt-1">
                              <span className="flex items-center">
                                <div className="w-2 h-2 bg-orange-400 rounded-full mr-1"></div>
                                {partner.orderStats?.assigned || 0} Assigned
                              </span>
                              <span className="flex items-center">
                                <div className="w-2 h-2 bg-blue-400 rounded-full mr-1"></div>
                                {partner.orderStats?.processing || 0} Processing
                              </span>
                              <span className="flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                                {partner.orderStats?.shipped || 0} Shipped
                              </span>
                              <span className="flex items-center">
                                <div className="w-2 h-2 bg-teal-400 rounded-full mr-1"></div>
                                {partner.orderStats?.vendor_paid || 0} Vendor Paid
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            partner.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {partner.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(partner.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => togglePartnerStatus(partner.id, partner.is_active)}
                            className={`${
                              partner.is_active 
                                ? 'text-red-600 hover:text-red-900' 
                                : 'text-green-600 hover:text-green-900'
                            } mr-4`}
                          >
                            {partner.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {partnersData.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No partners found. Create your first partner to get started.
                  </div>
                )}
              </div>
            )}
              </>
            )}
            
            {/* Ambassadors Content */}
            {partnersSubTab === 'ambassadors' && (
              <>
                {/* Ambassador View Tabs */}
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setAmbassadorView('ambassadors')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        ambassadorView === 'ambassadors'
                          ? 'bg-[#3eb489] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      👥 Ambassadors
                    </button>
                    <button
                      onClick={() => setAmbassadorView('bounties')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        ambassadorView === 'bounties'
                          ? 'bg-[#3eb489] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      🎯 Bounties
                    </button>
                    <button
                      onClick={() => setAmbassadorView('submissions')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        ambassadorView === 'submissions'
                          ? 'bg-[#3eb489] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      📝 Submissions
                    </button>
                    <button
                      onClick={() => setAmbassadorView('payouts')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        ambassadorView === 'payouts'
                          ? 'bg-[#3eb489] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      💰 Payouts
                    </button>
                  </div>
                </div>
                
                {/* Ambassadors View */}
                {ambassadorView === 'ambassadors' && (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-md font-semibold text-gray-700">Manage Ambassadors</h3>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => setShowAddAmbassador(true)}
                          className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                        >
                          ➕ Add Ambassador
                        </button>
                        <button
                          onClick={loadAmbassadors}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                    </div>
                    
                    {ambassadorsLoading ? (
                      <div className="p-6 text-center">
                        <div className="text-gray-500">Loading ambassadors...</div>
                      </div>
                    ) : ambassadorsError ? (
                      <div className="p-6 text-center">
                        <div className="text-red-600">{ambassadorsError}</div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Ambassador
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Total Earned
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Completed
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Joined
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {ambassadorsData.map((ambassador) => (
                              <tr key={ambassador.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                  <div 
                                    className="flex items-center space-x-2 cursor-pointer"
                                    onClick={() => openUserModal(ambassador.fid)}
                                  >
                                    {ambassador.profiles?.pfp_url && (
                                      <img
                                        src={ambassador.profiles.pfp_url}
                                        alt={ambassador.profiles.username}
                                        className="w-8 h-8 rounded-full"
                                      />
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        @{ambassador.profiles?.username || `FID ${ambassador.fid}`}
                                      </div>
                                      {ambassador.profiles?.display_name && (
                                        <div className="text-xs text-gray-500">
                                          {ambassador.profiles.display_name}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-green-600">
                                    {(ambassador.total_earned_tokens || 0).toLocaleString()} 🪙
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {ambassador.total_bounties_completed || 0} bounties
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    ambassador.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {ambassador.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(ambassador.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <button
                                    onClick={() => toggleAmbassadorStatus(ambassador.id, ambassador.is_active)}
                                    className={`${
                                      ambassador.is_active
                                        ? 'text-red-600 hover:text-red-900'
                                        : 'text-green-600 hover:text-green-900'
                                    } font-medium`}
                                  >
                                    {ambassador.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {ambassadorsData.length === 0 && (
                          <div className="p-6 text-center text-gray-500">
                            No ambassadors yet. Add your first ambassador to get started.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Bounties View */}
                {ambassadorView === 'bounties' && (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-md font-semibold text-gray-700">Manage Bounties</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={loadBounties}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                        >
                          🔄 Refresh
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBountyForEdit(null);
                            setShowCreateBounty(true);
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm"
                        >
                          + Create Bounty
                        </button>
                      </div>
                    </div>
                    
                    {bountiesLoading ? (
                      <div className="p-6 text-center">
                        <div className="text-gray-500">Loading bounties...</div>
                      </div>
                    ) : bountiesError ? (
                      <div className="p-6 text-center">
                        <div className="text-red-600">{bountiesError}</div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bounty</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completions</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {bountiesData.map((bounty) => (
                              <tr key={bounty.id}>
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">{bounty.title}</div>
                                    <div className="text-xs text-gray-500 line-clamp-2">{bounty.description}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-green-600">
                                    {bounty.reward_tokens ? Number(bounty.reward_tokens).toLocaleString() : '0'} $MINTEDMERCH
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    bounty.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {bounty.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {bounty.current_completions || 0} / {bounty.max_completions}
                                  {bounty.max_submissions_per_ambassador && (
                                    <div className="text-xs text-gray-500">
                                      Max {bounty.max_submissions_per_ambassador} per ambassador
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <button
                                    onClick={() => {
                                      setSelectedBountyForEdit(bounty);
                                      setShowCreateBounty(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 font-medium mr-3"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => toggleBountyStatus(bounty.id, bounty.is_active)}
                                    className={`${
                                      bounty.is_active
                                        ? 'text-red-600 hover:text-red-900'
                                        : 'text-green-600 hover:text-green-900'
                                    } font-medium`}
                                  >
                                    {bounty.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {bountiesData.length === 0 && (
                          <div className="p-6 text-center text-gray-500">
                            No bounties yet. Create your first bounty to get started.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Submissions View */}
                {ambassadorView === 'submissions' && (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-md font-semibold text-gray-700">Review Submissions</h3>
                      <div className="flex space-x-2">
                        <select
                          value={submissionsFilter}
                          onChange={(e) => setSubmissionsFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="all">All Submissions</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <button
                          onClick={loadSubmissions}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                    </div>
                    
                    {submissionsLoading ? (
                      <div className="p-6 text-center">
                        <div className="text-gray-500">Loading submissions...</div>
                      </div>
                    ) : submissionsError ? (
                      <div className="p-6 text-center">
                        <div className="text-red-600">{submissionsError}</div>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {submissionsData.map((submission) => (
                          <div key={submission.id} className="p-6 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h4 className="text-lg font-semibold text-gray-900">
                                    {submission.bounties?.title}
                                  </h4>
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {submission.status.toUpperCase()}
                                  </span>
                                </div>
                                
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>
                                    <span className="font-medium">Ambassador:</span>{' '}
                                    <span 
                                      className="text-blue-600 cursor-pointer hover:underline"
                                      onClick={() => openUserModal(submission.ambassadors?.fid)}
                                    >
                                      @{submission.ambassadors?.profiles?.username}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Reward:</span>{' '}
                                    <span className="text-green-600 font-bold">
                                      {submission.bounties?.reward_tokens?.toLocaleString()} 🪙
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Submitted:</span>{' '}
                                    {new Date(submission.submitted_at).toLocaleString()}
                                  </div>
                                  <div>
                                    <span className="font-medium">Proof:</span>{' '}
                                    <a
                                      href={submission.proof_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      View Submission →
                                    </a>
                                  </div>
                                  {submission.proof_description && (
                                    <div>
                                      <span className="font-medium">Description:</span>{' '}
                                      {submission.proof_description}
                                    </div>
                                  )}
                                  {submission.admin_notes && (
                                    <div className="mt-2 p-2 bg-blue-50 rounded-md">
                                      <span className="font-medium text-blue-900">Admin Notes:</span>{' '}
                                      <span className="text-blue-800">{submission.admin_notes}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="ml-4 flex flex-col space-y-2">
                                {submission.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveSubmission(submission.id, submission.bounties?.title)}
                                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                                    >
                                      ✅ Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectSubmission(submission.id, submission.bounties?.title)}
                                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                                    >
                                      ❌ Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {submissionsData.length === 0 && (
                          <div className="p-6 text-center text-gray-500">
                            No submissions found.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Payouts View */}
                {ambassadorView === 'payouts' && (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-md font-semibold text-gray-700">Manage Payouts</h3>
                      <div className="flex space-x-2">
                        <select
                          value={payoutsFilter}
                          onChange={(e) => setPayoutsFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="all">All Payouts</option>
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button
                          onClick={loadPayouts}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                    </div>
                    
                    {payoutsLoading ? (
                      <div className="p-6 text-center">
                        <div className="text-gray-500">Loading payouts...</div>
                      </div>
                    ) : payoutsError ? (
                      <div className="p-6 text-center">
                        <div className="text-red-600">{payoutsError}</div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Ambassador
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Amount
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Wallet
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Created
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payoutsData.map((payout) => (
                              <tr key={payout.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                  <div 
                                    className="text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                    onClick={() => openUserModal(payout.ambassadors?.fid)}
                                  >
                                    @{payout.ambassadors?.profiles?.username}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-green-600">
                                    {payout.amount_tokens.toLocaleString()} 🪙
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {payout.wallet_address ? (
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="text-xs font-mono text-blue-600 cursor-pointer hover:text-blue-800 hover:underline"
                                        onClick={() => {
                                          navigator.clipboard.writeText(payout.wallet_address);
                                          setCopiedWallet(payout.id);
                                          setTimeout(() => setCopiedWallet(null), 2000);
                                        }}
                                        title="Click to copy full address"
                                      >
                                        {payout.wallet_address.slice(0, 6)}...{payout.wallet_address.slice(-4)}
                                      </div>
                                      {copiedWallet === payout.id && (
                                        <span className="text-green-600 text-sm font-bold animate-pulse">✓</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-red-600">No wallet</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    payout.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    payout.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    payout.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {payout.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(payout.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {payout.status === 'pending' && payout.wallet_address && (
                                    <button
                                      onClick={() => handleCompletePayout(
                                        payout.id,
                                        payout.ambassadors?.profiles?.username,
                                        payout.amount_tokens
                                      )}
                                      className="text-green-600 hover:text-green-900 font-medium"
                                    >
                                      Mark Complete
                                    </button>
                                  )}
                                  {payout.transaction_hash && (
                                    <a
                                      href={`https://basescan.org/tx/${payout.transaction_hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-xs"
                                    >
                                      View TX
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {payoutsData.length === 0 && (
                          <div className="p-6 text-center text-gray-500">
                            No payouts found.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Add Ambassador Modal */}
        {showAddAmbassador && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Add New Ambassador</h2>
                  <button
                    onClick={() => setShowAddAmbassador(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Farcaster ID (FID) *
                    </label>
                    <input
                      type="number"
                      value={addAmbassadorFid}
                      onChange={(e) => setAddAmbassadorFid(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                      placeholder="123456"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The user must have already signed in to the app
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={addAmbassadorNotes}
                      onChange={(e) => setAddAmbassadorNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                      placeholder="Additional notes about this ambassador..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => setShowAddAmbassador(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAmbassador}
                    className="flex-1 bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md"
                  >
                    Add Ambassador
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Bounty Modal */}
        {showCreateBounty && (
          <CreateBountyModal 
            bounty={selectedBountyForEdit}
            onClose={() => {
              setShowCreateBounty(false);
              setSelectedBountyForEdit(null);
            }}
            onSuccess={() => {
              loadBounties();
              setShowCreateBounty(false);
              setSelectedBountyForEdit(null);
            }}
            adminFetch={adminFetch}
            ambassadorsData={ambassadorsData}
          />
        )}

        {/* Create Partner Modal */}
        {showCreatePartner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Add New Partner</h2>
                  <button
                    onClick={() => setShowCreatePartner(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={createPartnerData.name}
                      onChange={(e) => setCreatePartnerData({...createPartnerData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Partner Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={createPartnerData.email}
                      onChange={(e) => setCreatePartnerData({...createPartnerData, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="partner@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={createPartnerData.password}
                      onChange={(e) => setCreatePartnerData({...createPartnerData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Farcaster ID (Optional)
                    </label>
                    <input
                      type="number"
                      value={createPartnerData.fid}
                      onChange={(e) => setCreatePartnerData({...createPartnerData, fid: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Link to Farcaster profile for notifications
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partner Type *
                    </label>
                    <select
                      value={createPartnerData.partner_type || 'fulfillment'}
                      onChange={(e) => setCreatePartnerData({...createPartnerData, partner_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="fulfillment">Fulfillment Partner</option>
                      <option value="collab">Collab Partner</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Fulfillment: Sees shipping addresses | Collab: Sees Farcaster profiles
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => setShowCreatePartner(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePartner}
                    className="flex-1 bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md"
                  >
                    Create Partner
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Chat Eligibility Tab */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow">
            <ChatAdminDashboard onOpenUserModal={openUserModal} />
          </div>
        )}

      </div>

      {/* User Modal */}
      <UserModal
        isOpen={userModalOpen}
        onClose={closeUserModal}
        userFid={selectedUserFid}
      />

      {/* Notification Confirmation Modal */}
      {showNotificationConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="bg-yellow-100 p-2 rounded-full mr-3">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800">Confirm Notification Send</h2>
              </div>
              
              <p className="text-gray-700 mb-4">
                Are you sure you want to send <strong>
                {showNotificationConfirm === 'daily' ? 'Daily Check-in' : 'Evening Check-in'}
                </strong> reminders to all eligible users?
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This will send notifications to all users who have notifications enabled. 
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowNotificationConfirm(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleManualNotification(showNotificationConfirm)}
                  disabled={notificationLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-md font-medium"
                >
                  {notificationLoading ? 'Sending...' : 'Send Notifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Edit Modal */}
      {orderEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Edit Order {selectedOrder?.order_id}</h2>
                <button
                  onClick={closeOrderEditModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Order Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Status
                  </label>
                  <select
                    value={orderEditData.status || ''}
                    onChange={(e) => setOrderEditData({...orderEditData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="processing">Processing</option>
                    <option value="assigned">Assigned</option>
                    <option value="shipped">Shipped</option>
                    <option value="vendor_paid">Vendor Paid</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                {/* Assigned Partner */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned Partner
                  </label>
                  <select
                    value={orderEditData.assigned_partner_id || ''}
                    onChange={(e) => setOrderEditData({...orderEditData, assigned_partner_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {partnersData.filter(partner => partner.is_active).map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name} ({partner.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a partner to assign this order for fulfillment
                  </p>
                </div>

                {/* Tracking Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={orderEditData.tracking_number || ''}
                    onChange={(e) => setOrderEditData({...orderEditData, tracking_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter tracking number"
                  />
                </div>

                {/* Auto-generated Tracking URL Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking URL (Auto-generated)
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm">
                    {orderEditData.tracking_number ? 
                      generateTrackingUrl(orderEditData.tracking_number) : 
                      'Enter tracking number to generate URL'
                    }
                  </div>
                  {orderEditData.tracking_number && orderEditData.tracking_number.startsWith('GM533396') && (
                    <div className="text-xs text-green-600 mt-1">
                      ✅ Fulfillment service tracking (auto-extracted base number)
                    </div>
                  )}
                  {orderEditData.tracking_number && !orderEditData.tracking_number.startsWith('GM533396') && (
                    <div className="text-xs text-blue-600 mt-1">
                      📦 Manual order tracking (using default base number)
                    </div>
                  )}
                </div>

                {/* Carrier */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Carrier
                  </label>
                  <select
                    value={orderEditData.carrier || ''}
                    onChange={(e) => setOrderEditData({...orderEditData, carrier: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select carrier</option>
                    <option value="UPS">UPS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="USPS">USPS</option>
                    <option value="DHL">DHL</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={orderEditData.customer_name || ''}
                    onChange={(e) => setOrderEditData({...orderEditData, customer_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer name"
                  />
                </div>

                {/* Customer Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={orderEditData.customer_email || ''}
                    onChange={(e) => setOrderEditData({...orderEditData, customer_email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="customer@example.com"
                  />
                </div>
              </div>

              {/* Notes field removed - doesn't exist in orders table */}

              {/* Shipping Address Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Shipping Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.firstName || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          firstName: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.lastName || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          lastName: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.address1 || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          address1: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.address2 || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          address2: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.city || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          city: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.province || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          province: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP/Postal Code
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.zip || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          zip: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={orderEditData.shipping_address?.country || ''}
                      onChange={(e) => setOrderEditData({
                        ...orderEditData,
                        shipping_address: {
                          ...orderEditData.shipping_address,
                          country: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={closeOrderEditModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOrderUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Update Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// CreateBountyModal Component
function CreateBountyModal({ bounty, onClose, onSuccess, adminFetch, ambassadorsData }) {
  const [formData, setFormData] = useState({
    title: bounty?.title || '',
    description: bounty?.description || '',
    requirements: bounty?.requirements || '',
    proofRequirements: bounty?.proof_requirements || '',
    rewardTokens: bounty?.reward_tokens || '',
    maxCompletions: bounty?.max_completions || '',
    maxSubmissionsPerAmbassador: bounty?.max_submissions_per_ambassador || '',
    expiresAt: bounty?.expires_at ? new Date(bounty.expires_at).toISOString().slice(0, 16) : '',
    bountyType: bounty?.bounty_type || 'custom',
    targetCastUrl: bounty?.target_cast_url || '',
    targetAmbassadorFids: bounty?.target_ambassador_fids || [] // Array of FIDs for targeted bounties
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [castPreview, setCastPreview] = useState(null);
  const [loadingCast, setLoadingCast] = useState(false);

  // Fetch cast details when URL is entered
  const handleCastUrlChange = async (url) => {
    setFormData({...formData, targetCastUrl: url});
    setCastPreview(null);

    if (!url.trim()) return;

    // Only fetch for Farcaster engagement bounties
    if (!['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'].includes(formData.bountyType)) {
      return;
    }

    // Basic URL validation - support both farcaster.xyz and warpcast.com (legacy)
    if (!url.includes('farcaster.xyz') && !url.includes('warpcast.com')) {
      setError('Please enter a valid Farcaster cast URL');
      return;
    }

    setLoadingCast(true);
    setError('');

    try {
      // Parse cast URL via API
      const response = await adminFetch('/api/admin/parse-cast-url', {
        method: 'POST',
        body: JSON.stringify({ castUrl: url })
      });

      const result = await response.json();

      if (result.success) {
        setCastPreview(result.data);
        setError('');
      } else {
        setError(result.error || 'Invalid cast URL');
        setCastPreview(null);
      }
    } catch (error) {
      console.error('Error fetching cast:', error);
      setError('Failed to fetch cast details');
      setCastPreview(null);
    } finally {
      setLoadingCast(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    // Farcaster engagement bounties have different requirements
    const isFarcasterBounty = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'].includes(formData.bountyType);
    
    // Auto-populate description for Farcaster bounties if empty
    if (isFarcasterBounty && !formData.description.trim()) {
      const autoDescriptions = {
        'farcaster_like': 'Like the Farcaster cast',
        'farcaster_recast': 'Recast the Farcaster post',
        'farcaster_comment': 'Comment on the Farcaster cast',
        'farcaster_engagement': 'Like, Recast, and Comment on the Farcaster cast'
      };
      formData.description = autoDescriptions[formData.bountyType];
    }
    
    // Description is only required for custom bounties
    if (!isFarcasterBounty && !formData.description.trim()) {
      setError('Description is required');
      return;
    }

    if (isFarcasterBounty) {
      // For Farcaster bounties, cast URL is required
      if (!formData.targetCastUrl.trim()) {
        setError('Cast URL is required for Farcaster engagement bounties');
        return;
      }
      if (!castPreview) {
        setError('Please enter a valid cast URL and wait for it to load');
        return;
      }
    } else {
      // For custom bounties, requirements and proof requirements are required
      if (!formData.requirements.trim()) {
        setError('Requirements are required');
        return;
      }
      if (!formData.proofRequirements.trim()) {
        setError('Proof requirements are required');
        return;
      }
    }

    if (!formData.rewardTokens || formData.rewardTokens <= 0) {
      setError('Reward amount must be greater than 0');
      return;
    }
    if (!formData.maxCompletions || formData.maxCompletions <= 0) {
      setError('Max completions must be greater than 0');
      return;
    }

    try {
      setSaving(true);

      const endpoint = bounty 
        ? `/api/admin/bounties/${bounty.id}`
        : '/api/admin/bounties';
      
      const method = bounty ? 'PUT' : 'POST';

      // Prepare data with proper date formatting and cast info
      const submitData = {
        ...formData,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        targetCastHash: castPreview?.hash || null,
        targetCastAuthorFid: castPreview?.authorFid || null,
        targetAmbassadorFids: formData.targetAmbassadorFids.length > 0 ? formData.targetAmbassadorFids : null
      };

      const response = await adminFetch(endpoint, {
        method,
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Failed to save bounty');
      }
    } catch (error) {
      console.error('Error saving bounty:', error);
      setError('Failed to save bounty. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {bounty ? 'Edit Bounty' : 'Create New Bounty'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bounty Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bounty Type *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={formData.bountyType === 'custom'}
                    onChange={(e) => setFormData({...formData, bountyType: e.target.value, targetCastUrl: ''})}
                    className="mr-2"
                  />
                  <span className="text-sm">Custom (Manual Verification)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="farcaster_like"
                    checked={formData.bountyType === 'farcaster_like'}
                    onChange={(e) => setFormData({...formData, bountyType: e.target.value})}
                    className="mr-2"
                  />
                  <span className="text-sm">❤️ Like a Farcaster Cast (Auto-Verified)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="farcaster_recast"
                    checked={formData.bountyType === 'farcaster_recast'}
                    onChange={(e) => setFormData({...formData, bountyType: e.target.value})}
                    className="mr-2"
                  />
                  <span className="text-sm">🔄 Recast a Farcaster Post (Auto-Verified)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="farcaster_comment"
                    checked={formData.bountyType === 'farcaster_comment'}
                    onChange={(e) => setFormData({...formData, bountyType: e.target.value})}
                    className="mr-2"
                  />
                  <span className="text-sm">💬 Comment on a Farcaster Cast (Auto-Verified)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="farcaster_engagement"
                    checked={formData.bountyType === 'farcaster_engagement'}
                    onChange={(e) => setFormData({...formData, bountyType: e.target.value})}
                    className="mr-2"
                  />
                  <span className="text-sm">🔥 Like + Recast + Comment (All 3!) (Auto-Verified)</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.bountyType === 'custom' 
                  ? 'Ambassadors submit proof links that require manual admin review.' 
                  : formData.bountyType === 'farcaster_engagement'
                  ? 'Maximum engagement! Ambassadors must like, recast, AND comment on the cast. All verified instantly via Neynar API.'
                  : 'Ambassadors complete the action on Farcaster, then click submit for instant verification via Neynar API.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder={formData.bountyType === 'custom' ? "e.g., Create a Minted Merch meme" : "e.g., Like our product launch post"}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description {!['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'].includes(formData.bountyType) && '*'}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder={['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'].includes(formData.bountyType) 
                  ? "Auto-generated based on bounty type (or add custom description)..." 
                  : "General overview of the bounty..."}
                rows={3}
                required={!['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'].includes(formData.bountyType)}
              />
            </div>

            {/* Cast URL field for Farcaster bounties */}
            {['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'].includes(formData.bountyType) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cast URL *
                </label>
                <input
                  type="url"
                  value={formData.targetCastUrl}
                  onChange={(e) => handleCastUrlChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  placeholder="https://farcaster.xyz/username/0x..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the full Farcaster cast URL (from farcaster.xyz)
                </p>
                {loadingCast && (
                  <div className="mt-2 text-sm text-gray-600">Loading cast...</div>
                )}
                {castPreview && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm text-green-800">
                      ✅ Cast found: @{castPreview.authorUsername} (FID: {castPreview.authorFid})
                    </div>
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {castPreview.text}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Requirements and Proof Requirements only for custom bounties */}
            {formData.bountyType === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requirements *
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    placeholder="Detailed requirements ambassadors must complete..."
                    rows={3}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    What does the ambassador need to do?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proof Requirements *
                  </label>
                  <textarea
                    value={formData.proofRequirements}
                    onChange={(e) => setFormData({...formData, proofRequirements: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                    placeholder="How should they submit proof? (e.g., Link to Farcaster cast, X post, etc.)"
                    rows={2}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    What type of proof link should they submit?
                  </p>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reward Amount ($MINTEDMERCH) *
                </label>
                <input
                  type="number"
                  value={formData.rewardTokens}
                  onChange={(e) => setFormData({...formData, rewardTokens: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  placeholder="1000000"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Total Completions *
                </label>
                <input
                  type="number"
                  value={formData.maxCompletions}
                  onChange={(e) => setFormData({...formData, maxCompletions: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  placeholder="10"
                  min="1"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Total submissions that can be approved
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Submissions Per Ambassador (Optional)
              </label>
              <input
                type="number"
                value={formData.maxSubmissionsPerAmbassador}
                onChange={(e) => setFormData({...formData, maxSubmissionsPerAmbassador: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder="Leave empty for unlimited"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many times can each ambassador submit this bounty? Leave empty for unlimited.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] cursor-pointer"
                placeholder="Click to set date & time"
              />
              <p className="text-xs text-gray-500 mt-1">
                Click to select when this bounty expires. Leave empty for no expiration.
              </p>
            </div>

            {/* Target Specific Ambassadors */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Specific Ambassadors (Optional)
              </label>
              <select
                multiple
                value={formData.targetAmbassadorFids.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                  setFormData({...formData, targetAmbassadorFids: selected});
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] h-32"
              >
                {ambassadorsData.map(amb => (
                  <option key={amb.fid} value={amb.fid}>
                    @{amb.username}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to make bounty available to ALL ambassadors. Hold Cmd/Ctrl to select multiple.
                {formData.targetAmbassadorFids.length > 0 && (
                  <span className="block mt-1 text-[#3eb489] font-medium">
                    Selected: {formData.targetAmbassadorFids.length} ambassador{formData.targetAmbassadorFids.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving...' : (bounty ? 'Update Bounty' : 'Create Bounty')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// CreateDiscountForm Component
function CreateDiscountForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    code_type: 'promotional',
    gating_type: 'none',
    discount_scope: 'site_wide',
    target_fids: '',
    target_wallets: '',
    target_products: '',
    contract_addresses: '',
    chain_ids: '1',
    required_balance: '1',
    minimum_order_amount: '',
    expires_at: '',
    max_uses_total: '',
    max_uses_per_user: '1',
    discount_description: '',
    free_shipping: false,
    is_shared_code: true,
    auto_apply: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [productsData, setProductsData] = useState([]);

  // Load products data on component mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products?limit=1000');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setProductsData(result.products);
          }
        }
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    loadProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Prepare the data
      const submitData = {
        ...formData,
        target_fids: formData.target_fids ? formData.target_fids.split(',').map(fid => parseInt(fid.trim())).filter(fid => !isNaN(fid)) : [],
        target_wallets: formData.target_wallets ? formData.target_wallets.split(',').map(wallet => wallet.trim()).filter(w => w) : [],
        target_products: formData.target_products ? formData.target_products.split(',').map(handle => handle.trim()).filter(h => h) : [],
        contract_addresses: formData.contract_addresses ? formData.contract_addresses.split(',').map(addr => addr.trim()).filter(a => a) : [],
        chain_ids: formData.chain_ids ? formData.chain_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [1]
      };

      const response = await adminFetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(); // Reload data
        onClose(); // Close modal
      } else {
        setError(result.error || 'Failed to create discount');
      }
    } catch (error) {
      console.error('Error creating discount:', error);
      setError('Failed to create discount');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discount Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Code *
          </label>
          <input
            type="text"
            required
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="SAVE20"
          />
        </div>

        {/* Discount Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Type *
          </label>
          <select
            value={formData.discount_type}
            onChange={(e) => handleInputChange('discount_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ($)</option>
          </select>
        </div>

        {/* Discount Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Value *
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.discount_value}
            onChange={(e) => handleInputChange('discount_value', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder={formData.discount_type === 'percentage' ? '15' : '5.00'}
          />
        </div>

        {/* Code Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Code Type
          </label>
          <select
            value={formData.code_type}
            onChange={(e) => handleInputChange('code_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="promotional">Promotional</option>
            <option value="welcome">Welcome</option>
            <option value="referral">Referral</option>
          </select>
        </div>

        {/* Gating Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Control
          </label>
          <select
            value={formData.gating_type}
            onChange={(e) => handleInputChange('gating_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="none">Public (Anyone can use)</option>
            <option value="whitelist_fid">Specific FIDs</option>
            <option value="whitelist_wallet">Specific Wallets</option>
            <option value="nft_holding">NFT Holders</option>
            <option value="token_balance">Token Balance</option>
            <option value="bankr_club">Bankr Club Members</option>
          </select>
        </div>

        {/* Discount Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Scope
          </label>
          <select
            value={formData.discount_scope}
            onChange={(e) => handleInputChange('discount_scope', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="site_wide">Site Wide</option>
            <option value="product">Product Specific</option>
          </select>
        </div>

        {/* Max Uses */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Total Uses
          </label>
          <input
            type="number"
            min="1"
            value={formData.max_uses_total}
            onChange={(e) => handleInputChange('max_uses_total', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      {/* Conditional Fields Based on Gating Type */}
      {formData.gating_type === 'whitelist_fid' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target FIDs (comma-separated)
          </label>
          <input
            type="text"
            value={formData.target_fids}
            onChange={(e) => handleInputChange('target_fids', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="123456, 789012, 345678"
          />
        </div>
      )}

      {formData.gating_type === 'whitelist_wallet' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Wallets (comma-separated)
          </label>
          <input
            type="text"
            value={formData.target_wallets}
            onChange={(e) => handleInputChange('target_wallets', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="0x123..., 0x456..."
          />
        </div>
      )}

      {/* Product Selection for Product-Specific Discounts */}
      {formData.discount_scope === 'product' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Products
          </label>
          <div className="space-y-2">
            <select
              multiple
              value={formData.target_products ? formData.target_products.split(',').map(p => p.trim()) : []}
              onChange={(e) => {
                const selectedHandles = Array.from(e.target.selectedOptions).map(option => option.value);
                handleInputChange('target_products', selectedHandles.join(', '));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] h-32"
            >
              {productsData.map(product => (
                <option key={product.handle} value={product.handle}>
                  {product.title} ({product.handle})
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              Hold Ctrl/Cmd to select multiple products. Selected: {formData.target_products ? formData.target_products.split(',').length : 0}
            </div>
            <div className="text-xs text-gray-500">
              Or manually enter product handles (comma-separated):
            </div>
            <input
              type="text"
              value={formData.target_products}
              onChange={(e) => handleInputChange('target_products', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="product-handle-1, product-handle-2, ..."
            />
          </div>
        </div>
      )}

      {(formData.gating_type === 'nft_holding' || formData.gating_type === 'token_balance') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Addresses (comma-separated)
            </label>
            <input
              type="text"
              value={formData.contract_addresses}
              onChange={(e) => handleInputChange('contract_addresses', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="0x123..., 0x456..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Balance
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.required_balance}
              onChange={(e) => handleInputChange('required_balance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="1"
            />
          </div>
        </div>
      )}

      {/* Optional Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Order Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.minimum_order_amount}
            onChange={(e) => handleInputChange('minimum_order_amount', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="25.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expires At
          </label>
          <input
            type="datetime-local"
            value={formData.expires_at}
            onChange={(e) => handleInputChange('expires_at', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.discount_description}
          onChange={(e) => handleInputChange('discount_description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          rows="3"
          placeholder="Internal description for this discount..."
        />
      </div>

      {/* Checkboxes */}
      <div className="flex space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.free_shipping}
            onChange={(e) => handleInputChange('free_shipping', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Free Shipping
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_shared_code}
            onChange={(e) => handleInputChange('is_shared_code', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Shared Code (multiple users can use)
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.auto_apply}
            onChange={(e) => handleInputChange('auto_apply', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Auto-apply discount
        </label>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#3eb489] hover:bg-[#359970] text-white px-6 py-2 rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Discount'}
        </button>
      </div>
    </form>
  );
} 

// EditDiscountForm Component
function EditDiscountForm({ discount, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    code: discount.code,
    discount_type: discount.discount_type,
    discount_value: discount.discount_value,
    code_type: discount.code_type,
    gating_type: discount.gating_type || 'none',
    discount_scope: discount.discount_scope || 'site_wide',
    target_fids: discount.whitelisted_fids ? (Array.isArray(discount.whitelisted_fids) ? discount.whitelisted_fids.join(', ') : discount.whitelisted_fids) : (discount.fid ? discount.fid.toString() : ''),
    target_wallets: discount.whitelisted_wallets ? (Array.isArray(discount.whitelisted_wallets) ? discount.whitelisted_wallets.join(', ') : discount.whitelisted_wallets) : '',
    target_products: (() => {
      if (discount.target_products) {
        try {
          const products = typeof discount.target_products === 'string' ? JSON.parse(discount.target_products) : discount.target_products;
          return Array.isArray(products) ? products.join(', ') : products;
        } catch (e) {
          return discount.target_products;
        }
      }
      return '';
    })(),
    contract_addresses: discount.contract_addresses ? (Array.isArray(discount.contract_addresses) ? discount.contract_addresses.join(', ') : discount.contract_addresses) : '',
    chain_ids: discount.chain_ids ? (Array.isArray(discount.chain_ids) ? discount.chain_ids.join(', ') : discount.chain_ids.toString()) : '1',
    required_balance: discount.required_balance || 1,
    minimum_order_amount: discount.minimum_order_amount || '',
    expires_at: discount.expires_at ? discount.expires_at.slice(0, 16) : '', // Format to YYYY-MM-DDTHH:MM
    max_uses_total: discount.max_uses_total || '',
    max_uses_per_user: discount.max_uses_per_user || 1,
    discount_description: discount.discount_description || '',
    free_shipping: discount.free_shipping || false,
    is_shared_code: discount.is_shared_code || false,
    auto_apply: discount.auto_apply || false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [productsData, setProductsData] = useState([]);

  // Load products data on component mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products?limit=1000');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setProductsData(result.products);
          }
        }
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    loadProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Prepare the data
      const submitData = {
        ...formData,
        target_fids: formData.target_fids ? formData.target_fids.split(',').map(fid => parseInt(fid.trim())).filter(fid => !isNaN(fid)) : [],
        target_wallets: formData.target_wallets ? formData.target_wallets.split(',').map(wallet => wallet.trim()).filter(w => w) : [],
        target_products: formData.target_products ? formData.target_products.split(',').map(handle => handle.trim()).filter(h => h) : [],
        contract_addresses: formData.contract_addresses ? formData.contract_addresses.split(',').map(addr => addr.trim()).filter(a => a) : [],
        chain_ids: formData.chain_ids ? formData.chain_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [1]
      };

      const response = await adminFetch(`/api/admin/discounts/${discount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(); // Reload data
        onClose(); // Close modal
      } else {
        setError(result.error || 'Failed to update discount');
      }
    } catch (error) {
      console.error('Error updating discount:', error);
      setError('Failed to update discount');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discount Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Code *
          </label>
          <input
            type="text"
            required
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="SAVE20"
          />
        </div>

        {/* Discount Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Type *
          </label>
          <select
            value={formData.discount_type}
            onChange={(e) => handleInputChange('discount_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ($)</option>
          </select>
        </div>

        {/* Discount Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Value *
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.discount_value}
            onChange={(e) => handleInputChange('discount_value', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder={formData.discount_type === 'percentage' ? '15' : '5.00'}
          />
        </div>

        {/* Code Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Code Type
          </label>
          <select
            value={formData.code_type}
            onChange={(e) => handleInputChange('code_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="promotional">Promotional</option>
            <option value="welcome">Welcome</option>
            <option value="referral">Referral</option>
          </select>
        </div>

        {/* Gating Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Control
          </label>
          <select
            value={formData.gating_type}
            onChange={(e) => handleInputChange('gating_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="none">Public (Anyone can use)</option>
            <option value="whitelist_fid">Specific FIDs</option>
            <option value="whitelist_wallet">Specific Wallets</option>
            <option value="nft_holding">NFT Holders</option>
            <option value="token_balance">Token Balance</option>
            <option value="bankr_club">Bankr Club Members</option>
          </select>
        </div>

        {/* Discount Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Scope
          </label>
          <select
            value={formData.discount_scope}
            onChange={(e) => handleInputChange('discount_scope', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="site_wide">Site Wide</option>
            <option value="product">Product Specific</option>
          </select>
        </div>

        {/* Max Uses */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Total Uses
          </label>
          <input
            type="number"
            min="1"
            value={formData.max_uses_total}
            onChange={(e) => handleInputChange('max_uses_total', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      {/* Conditional Fields Based on Gating Type */}
      {formData.gating_type === 'whitelist_fid' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target FIDs (comma-separated)
          </label>
          <input
            type="text"
            value={formData.target_fids}
            onChange={(e) => handleInputChange('target_fids', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="123456, 789012, 345678"
          />
        </div>
      )}

      {formData.gating_type === 'whitelist_wallet' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Wallets (comma-separated)
          </label>
          <input
            type="text"
            value={formData.target_wallets}
            onChange={(e) => handleInputChange('target_wallets', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="0x123..., 0x456..."
          />
        </div>
      )}

      {/* Product Selection for Product-Specific Discounts */}
      {formData.discount_scope === 'product' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Products
          </label>
          <div className="space-y-2">
            <select
              multiple
              value={formData.target_products ? formData.target_products.split(',').map(p => p.trim()) : []}
              onChange={(e) => {
                const selectedHandles = Array.from(e.target.selectedOptions).map(option => option.value);
                handleInputChange('target_products', selectedHandles.join(', '));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] h-32"
            >
              {productsData.map(product => (
                <option key={product.handle} value={product.handle}>
                  {product.title} ({product.handle})
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              Hold Ctrl/Cmd to select multiple products. Selected: {formData.target_products ? formData.target_products.split(',').length : 0}
            </div>
            <div className="text-xs text-gray-500">
              Or manually enter product handles (comma-separated):
            </div>
            <input
              type="text"
              value={formData.target_products}
              onChange={(e) => handleInputChange('target_products', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="product-handle-1, product-handle-2, ..."
            />
          </div>
        </div>
      )}

      {(formData.gating_type === 'nft_holding' || formData.gating_type === 'token_balance') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Addresses (comma-separated)
            </label>
            <input
              type="text"
              value={formData.contract_addresses}
              onChange={(e) => handleInputChange('contract_addresses', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="0x123..., 0x456..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Balance
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.required_balance}
              onChange={(e) => handleInputChange('required_balance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="1"
            />
          </div>
        </div>
      )}

      {/* Optional Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Order Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.minimum_order_amount}
            onChange={(e) => handleInputChange('minimum_order_amount', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="25.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expires At
          </label>
          <input
            type="datetime-local"
            value={formData.expires_at}
            onChange={(e) => handleInputChange('expires_at', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.discount_description}
          onChange={(e) => handleInputChange('discount_description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          rows="3"
          placeholder="Internal description for this discount..."
        />
      </div>

      {/* Checkboxes */}
      <div className="flex space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.free_shipping}
            onChange={(e) => handleInputChange('free_shipping', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Free Shipping
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_shared_code}
            onChange={(e) => handleInputChange('is_shared_code', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Shared Code (multiple users can use)
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.auto_apply}
            onChange={(e) => handleInputChange('auto_apply', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Auto-apply discount
        </label>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#3eb489] hover:bg-[#359970] text-white px-6 py-2 rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Updating...' : 'Update Discount'}
        </button>
      </div>
    </form>
  );
} 