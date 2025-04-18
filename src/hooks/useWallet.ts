
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Wallet } from '@/types';

export const useWallet = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      if (!user?.id) {
        // Rather than throwing, return null to indicate user not authenticated
        return null;
      }

      try {
        const { data: walletData, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
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

        let isDemo = false;
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('is_demo')
            .eq('id', user.id)
            .single();
          
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
    enabled: !!user,
  });
};
