import { User, Match } from '@/types';
import { supabase } from "@/integrations/supabase/client";

// Current user session
let currentUser: User | null = null;

// In-memory storage for demo matches
let demoMatches: Match[] = [];

// Function with fixed mapping between database fields and our Match type
const mapDatabaseMatchToMatch = (match: any): Match => {
  return {
    id: match.id,
    whitePlayerId: match.white_player_id,
    blackPlayerId: match.black_player_id,
    whiteUsername: match.white_username || 'Unknown',
    blackUsername: match.black_username || 'Unknown',
    stake: match.stake_amount,
    status: match.status as 'pending' | 'active' | 'completed' | 'cancelled',
    winner: match.winner_id,
    timeControl: match.time_control?.toString() || '10',
    gameMode: match.game_mode || (parseInt(match.time_control?.toString() || '10') <= 5 ? 'blitz' : 'rapid'),
    lichessGameId: match.lichess_game_id || match.pgn,
    createdAt: match.created_at,
    updatedAt: match.updated_at || match.created_at,
    fee_accepted: match.fee_accepted || false
  };
};

export const userService = {
  // Login user
  login: async (username: string, password: string): Promise<User> => {
    try {
      // Only allow login if password is provided
      if (!password) {
        throw new Error("Password is required");
      }
      
      // Try to authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: username, // Use the email/username directly
        password: password
      });

      if (authError) throw authError;
      
      if (authData?.user) {
        // Check if the user is a demo account
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_demo, username, avatar_url')
          .eq('id', authData.user.id)
          .single();
          
        // Get wallet info
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', authData.user.id)
          .single();
          
        const user: User = {
          id: authData.user.id,
          username: profileData?.username || username,
          balance: walletData?.balance || 0,
          avatar: profileData?.avatar_url || '♟',
          email: authData.user.email
        };
          
        currentUser = user;
        return user;
      }
      
      throw new Error("Authentication failed");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (session?.session?.user) {
        const userId = session.session.user.id;
        
        // Check if the user is a demo account
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_demo, username, avatar_url')
          .eq('id', userId)
          .single();
          
        // Get wallet info
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single();
          
        const user: User = {
          id: userId,
          username: profileData?.username || 'User',
          balance: walletData?.balance || 0,
          avatar: profileData?.avatar_url || '♟',
          email: session.session.user.email
        };
          
        currentUser = user;
        return user;
      }
    } catch (error) {
      console.error("Get current user error:", error);
    }
    
    return Promise.resolve(currentUser);
  },

  // Set current user
  setCurrentUser: (user: User): void => {
    currentUser = user;
  },

  // Logout user
  logout: async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      currentUser = null;
      demoMatches = []; // Clear demo matches on logout
      return Promise.resolve();
    } catch (error) {
      console.error("Logout error:", error);
      return Promise.resolve();
    }
  },

  // Get user by ID
  getUserById: async (id: string): Promise<User | null> => {
    try {
      // Check if this is a demo ID
      if (id.startsWith('demo_')) {
        return currentUser && currentUser.id === id ? currentUser : null;
      }
      
      // Get user from Supabase
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url, is_demo')
        .eq('id', id)
        .single();
        
      if (profileError) throw profileError;
      
      // Get wallet info
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', id)
        .single();
        
      if (walletError) throw walletError;
      
      return {
        id,
        username: profileData.username || 'User',
        balance: walletData.balance || 0,
        avatar: profileData.avatar_url || '♟'
      };
      
    } catch (error) {
      console.error("Get user by ID error:", error);
      return null;
    }
  },

  // Get all users
  getAllUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('is_demo', false)
        .limit(100);
        
      if (error) throw error;
      
      const users = await Promise.all(data.map(async (profile) => {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', profile.id)
          .single();
          
        return {
          id: profile.id,
          username: profile.username || 'User',
          balance: walletData?.balance || 0,
          avatar: profile.avatar_url || '♟'
        };
      }));
      
      return users;
    } catch (error) {
      console.error("Get all users error:", error);
      return [];
    }
  },

  // Update user balance
  updateBalance: async (userId: string, amount: number): Promise<User> => {
    try {
      // Check if this is a demo ID
      if (userId.startsWith('demo_')) {
        if (currentUser && currentUser.id === userId) {
          currentUser.balance += amount;
          return currentUser;
        }
        throw new Error('Demo user not found');
      }
      
      // Update balance in Supabase
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (walletError) throw walletError;
      
      const newBalance = (walletData.balance || 0) + amount;
      
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', walletData.id);
        
      if (updateError) throw updateError;
      
      // Get updated user
      const user = await userService.getUserById(userId);
      if (!user) throw new Error('Failed to get updated user');
      
      return user;
    } catch (error) {
      console.error("Update balance error:", error);
      throw error;
    }
  }
};
