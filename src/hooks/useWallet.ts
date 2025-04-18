
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Wallet } from '@/types';

export const useWallet = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('No user ID, returning null wallet');
        return null;
      }

      try {
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
          const { data: newWallet, error: createError } = await supabase
            .from('wallets')
            .insert({
              user_id: user.id,
              balance: 0
            })
            .select('*')
            .maybeSingle();

          if (createError) {
            console.error('Error creating wallet:', createError);
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
  });
};
