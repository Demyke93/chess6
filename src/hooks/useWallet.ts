
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
          throw walletError;
        }

        // If wallet doesn't exist for this user, create one
        if (!walletData) {
          console.log('Creating new wallet for user', user.id);
          
          try {
            // Create the wallet
            const { data: newWallet, error: createError } = await supabase
              .from('wallets')
              .insert({
                user_id: user.id,
                balance: 0
              })
              .select('*')
              .single();

            if (createError) {
              console.error('Error creating wallet:', createError);
              throw createError;
            }
            
            console.log('Successfully created wallet:', newWallet);
            
            // Return the newly created wallet
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
            }
            
            return { ...newWallet, is_demo: isDemo } as Wallet;
          } catch (error) {
            console.error('Failed to create wallet, returning placeholder:', error);
            throw new Error('Failed to create wallet: ' + error.message);
          }
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
        }

        return { ...walletData, is_demo: isDemo } as Wallet;
      } catch (error) {
        console.error('Error in wallet fetch:', error);
        throw new Error('Error fetching wallet: ' + error.message);
      }
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    retry: 3,
  });
};
