'use client';

import { useState, useEffect } from 'react';

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
    excludePreviousWinners: true
  });
  const [raffleResults, setRaffleResults] = useState([]);
  const [winnerProfiles, setWinnerProfiles] = useState({});
  const [numWinners, setNumWinners] = useState(1);
  
  // Past Raffles state
  const [pastRaffles, setPastRaffles] = useState([]);
  const [pastRafflesLoading, setPastRafflesLoading] = useState(false);
  const [pastRafflesError, setPastRafflesError] = useState('');

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
  
  // Leaderboard sorting state
  const [sortField, setSortField] = useState('total_points');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Discounts state
  const [discountsData, setDiscountsData] = useState([]);
  const [showCreateDiscount, setShowCreateDiscount] = useState(false);
  const [productsData, setProductsData] = useState([]);
  const [productsSyncLoading, setProductsSyncLoading] = useState(false);
  const [copiedButtons, setCopiedButtons] = useState(new Set());
  const [showEditDiscount, setShowEditDiscount] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  
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
      
      if (response.ok) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [leaderboardRes, statsRes, ordersRes, discountsRes, productsRes] = await Promise.all([
        fetch('/api/points/leaderboard?limit=1000'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/orders'),
        fetch('/api/admin/discounts'),
        fetch('/api/products')
      ]);
      
      const leaderboard = await leaderboardRes.json();
      const stats = await statsRes.json();
      const orders = await ordersRes.json();
      const discounts = await discountsRes.json();
      const products = await productsRes.json();
      
      setLeaderboardData(leaderboard.data?.leaderboard || []);
      setDashboardStats(stats.data);
      setOrdersData(orders.data || []);
      setDiscountsData(discounts.data || []);
      setProductsData(products.products || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const runRaffle = async (winnersCount = null, customFilters = null, criteriaDescription = null) => {
    try {
      const winners = winnersCount || numWinners;
      const filters = customFilters || raffleFilters;
      
      const response = await fetch('/api/admin/raffle', {
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
      const response = await fetch('/api/admin/raffle');
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
      const response = await fetch(`/api/admin/raffle/${raffleId}`, {
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
      const response = await fetch('/api/admin/users');
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
      const response = await fetch('/api/admin/checkins');
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

  // Leaderboard sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
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
    if (!discountsData || discountsData.length === 0) return [];
    
    // Apply filters
    let filtered = discountsData.filter(discount => {
      // Search filter
      if (discountFilters.searchTerm) {
        const searchLower = discountFilters.searchTerm.toLowerCase();
        const matchesSearch = 
          discount.code.toLowerCase().includes(searchLower) ||
          discount.discount_description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Gating type filter
      if (discountFilters.gatingType !== 'all') {
        if (discount.gating_type !== discountFilters.gatingType) return false;
      }
      
      // Code type filter
      if (discountFilters.codeType !== 'all') {
        if (discount.code_type !== discountFilters.codeType) return false;
      }
      
      // Status filter
      if (discountFilters.status !== 'all') {
        if (discountFilters.status === 'active' && !discount.is_active) return false;
        if (discountFilters.status === 'expired' && !discount.is_expired) return false;
        if (discountFilters.status === 'inactive' && (discount.is_active || discount.is_expired)) return false;
      }
      
      // Discount scope filter
      if (discountFilters.discountScope !== 'all') {
        if (discount.discount_scope !== discountFilters.discountScope) return false;
      }
      
      return true;
    });
    
    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue = a[discountSortField];
      let bValue = b[discountSortField];
      
      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue || '';
        bValue = bValue || '';
        return discountSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Handle numeric sorting
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
      
      return discountSortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    });
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
      const response = await fetch(`/api/admin/discounts/${discountId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadDashboardData();
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
                { key: 'users', label: '👥 Users' },
                { key: 'orders', label: '🛍️ Orders' },
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
                <div className="flex space-x-3">
                  <button
                    onClick={() => copyToClipboard('https://mintedmerch.vercel.app/', 'main-page-url')}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {dashboardStats && [
                { label: 'Total Users', value: dashboardStats.totalUsers, icon: '👥' },
                { label: 'Users on Leaderboard', value: dashboardStats.usersOnLeaderboard, icon: '🏆' },
                { label: 'Active Streaks', value: dashboardStats.activeStreaks, icon: '🔥' },
                { label: 'Check-Ins Today', value: dashboardStats.checkInsToday, icon: '📅' },
                { label: 'Users with Notifications', value: dashboardStats.usersWithNotifications, icon: '🔔' },
                { label: 'Total Points Awarded', value: dashboardStats.totalPoints?.toLocaleString(), icon: '⭐' },
                { label: 'Discounts Used', value: dashboardStats.discountsUsed, icon: '🎫' },
                { label: 'Total Orders', value: dashboardStats.totalOrders, icon: '🛍️' }
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
                        onClick={() => copyToClipboard(`https://mintedmerch.vercel.app/product/${product.handle}`, `product-${product.id}`)}
                        className="w-full bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        {copiedButtons.has(`product-${product.id}`) ? '✅ Copied!' : '📋 Copy Product URL'}
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
                        onClick={() => handleUsersSort('email')}
                      >
                        Email {usersSortField === 'email' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('x_username')}
                      >
                        X Username {usersSortField === 'x_username' && (usersSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleUsersSort('bankr_club_member')}
                      >
                        Bankr Club {usersSortField === 'bankr_club_member' && (usersSortDirection === 'asc' ? '↑' : '↓')}
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
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
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
                              <div className="text-sm font-medium text-gray-900">
                                {user.display_name || user.username || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500">@{user.username || 'unknown'}</div>
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
                          {user.email ? (
                            <span className="text-green-600">{user.email}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
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
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
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
                            <div className="font-medium text-gray-900">{user.display_name || user.username || 'Unknown'}</div>
                            <div className="text-gray-500">@{user.username || 'unknown'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.total_points?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.checkin_streak}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.points_from_purchases || 0}</td>
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
              <h2 className="text-lg font-semibold text-gray-800">All Orders</h2>
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrdersSort('status')}
                    >
                      Status {ordersSortField === 'status' && (ordersSortDirection === 'asc' ? '↑' : '↓')}
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
                          <div className="flex-shrink-0 h-8 w-8 mr-3">
                            {order.pfp_url ? (
                              <img 
                                src={order.pfp_url} 
                                alt={order.username || 'User'} 
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div 
                                className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                                style={{ display: order.pfp_url ? 'none' : 'flex' }}
                              >
                                {order.username?.charAt(0).toUpperCase() || order.fid?.toString().charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{order.username || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{order.customer_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{order.customer_email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
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
                    onClick={loadDashboardData}
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
                    onChange={(e) => setDiscountFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  />
                  <select
                    value={discountFilters.gatingType}
                    onChange={(e) => setDiscountFilters(prev => ({ ...prev, gatingType: e.target.value }))}
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
                    onChange={(e) => setDiscountFilters(prev => ({ ...prev, codeType: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  >
                    <option value="all">All Code Types</option>
                    <option value="welcome">Welcome</option>
                    <option value="promotional">Promotional</option>
                    <option value="referral">Referral</option>
                  </select>
                  <select
                    value={discountFilters.status}
                    onChange={(e) => setDiscountFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={discountFilters.discountScope}
                    onChange={(e) => setDiscountFilters(prev => ({ ...prev, discountScope: e.target.value }))}
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
                  
                                     <CreateDiscountForm onClose={() => setShowCreateDiscount(false)} onSuccess={loadDashboardData} />
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
                  
                  <EditDiscountForm discount={editingDiscount} onClose={() => setShowEditDiscount(false)} onSuccess={loadDashboardData} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check-ins Tab */}
        {activeTab === 'checkins' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">📅 Check-ins</h2>
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
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
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
                              <div className="font-medium text-gray-900">{checkin.display_name || checkin.username || 'Unknown'}</div>
                              <div className="text-gray-500">@{checkin.username || 'unknown'}</div>
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

      const response = await fetch('/api/admin/discounts', {
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

      const response = await fetch(`/api/admin/discounts/${discount.id}`, {
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