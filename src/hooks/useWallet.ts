
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Wallet } from '@/types';

export const useWallet = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (walletError) throw walletError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_demo')
        .eq('id', user?.id)
        .single();
      
      if (profileError) throw profileError;

      return { ...walletData, is_demo: profileData.is_demo } as Wallet;
    },
    enabled: !!user,
  });
};
