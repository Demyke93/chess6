
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Wallet } from '@/types';

export const useWallet = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('No user ID, returning null wallet');
        return null;
      }

      try {
        // First check if wallet already exists
        const { data: walletData, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (walletError) {
          console.error('Error fetching wallet data:', walletError);
          // Return empty wallet with default values instead of throwing
          return {
            id: '',
            user_id: user.id,
            balance: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_demo: false
          } as Wallet;
        }

        // If wallet doesn't exist for this user, create one
        if (!walletData) {
          console.log('Creating new wallet for user', user.id);
          
          // Check if there's a pending wallet first
          const { data: pendingWallet } = await queryClient.fetchQuery({
            queryKey: ['pending-wallet', user.id],
            queryFn: async () => {
              return null; // Just to check if there's a pending creation
            },
            staleTime: 0
          });
          
          if (pendingWallet) {
            console.log('Found pending wallet creation, waiting...');
            return null;
          }
          
          // Set a pending flag to prevent multiple creations
          queryClient.setQueryData(['pending-wallet', user.id], { pending: true });
          
          // Create the wallet
          const { data: newWallet, error: createError } = await supabase
            .from('wallets')
            .insert({
              user_id: user.id,
              balance: 0
            })
            .select('*')
            .single();

          // Remove pending flag
          queryClient.removeQueries({ queryKey: ['pending-wallet', user.id] });

          if (createError) {
            console.error('Error creating wallet:', createError);
            if (createError.code === '42501') { // Permission denied error
              console.warn('Permission denied when creating wallet. This may be due to RLS policies.');
              // Let's handle this gracefully by returning a placeholder wallet
              return {
                id: 'temporary-id',
                user_id: user.id,
                balance: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_demo: false,
                isPlaceholder: true // Flag to identify this is a placeholder
              } as Wallet & { isPlaceholder: boolean };
            }
            
            // Return default wallet for other errors
            return {
              id: '',
              user_id: user.id,
              balance: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_demo: false
            } as Wallet;
          }
          
          return {
            ...newWallet,
            is_demo: false
          } as Wallet;
        }

        let isDemo = false;
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('is_demo')
            .eq('id', user.id)
            .maybeSingle();
          
          isDemo = profileData?.is_demo || false;
        } catch (err) {
          console.error('Error fetching profile data:', err);
          // Continue even if profile data couldn't be fetched
        }

        return { ...walletData, is_demo: isDemo } as Wallet;
      } catch (error) {
        console.error('Error in wallet fetch:', error);
        // Return empty wallet with default values instead of throwing
        return {
          id: '',
          user_id: user.id,
          balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_demo: false
        } as Wallet;
      }
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });
};
