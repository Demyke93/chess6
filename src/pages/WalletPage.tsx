
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CoinConversionInfo } from '@/components/CoinConversionInfo';
import { FormEvent } from 'react';
import { Wallet as WalletIcon, Loader2, RefreshCcw } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { TransactionForm } from '@/components/wallet/TransactionForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConversionRate } from '@/hooks/useConversionRate';
import { WithdrawalDialog } from '@/components/wallet/WithdrawalDialog';
import { useBanks } from '@/hooks/useBanks';

const WalletPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState("balance");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { 
    data: wallet, 
    isLoading: walletLoading, 
    refetch: refetchWallet,
    error: walletError,
  } = useWallet();
  
  const { 
    data: transactions = [], 
    isLoading: transactionsLoading, 
    refetch: refetchTransactions 
  } = useTransactions(wallet?.id);

  const { data: banks } = useBanks();

  const { data: conversionRate } = useConversionRate();

  const nairaRate = typeof conversionRate?.value === 'object' 
    ? (conversionRate.value as any).naira_to_coin || 1000 
    : 1000;
  const minDeposit = typeof conversionRate?.value === 'object' 
    ? (conversionRate.value as any).min_deposit || 1000 
    : 1000;
  const minWithdrawal = typeof conversionRate?.value === 'object' 
    ? (conversionRate.value as any).min_withdrawal || 1000 
    : 1000;

  const handleRefreshWallet = async () => {
    setIsRefreshing(true);
    try {
      await refetchWallet();
      await refetchTransactions();
      toast({
        title: 'Refreshed',
        description: 'Wallet data has been refreshed'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh wallet data',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeposit = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to make a deposit',
        variant: 'destructive',
      });
      return;
    }
    
    if (!user.email) {
      toast({
        title: 'Error',
        description: 'No email found for your account. Please update your profile.',
        variant: 'destructive',
      });
      return;
    }

    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount < minDeposit) {
      toast({
        title: 'Error',
        description: `Minimum deposit amount is ₦${minDeposit.toLocaleString()}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check for wallet
      if (!wallet || walletError) {
        toast({
          title: 'Error',
          description: 'Unable to access your wallet. Please try refreshing the page.',
          variant: 'destructive',
        });
        return;
      }

      // Generate a unique reference for this transaction
      const reference = `chess_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      // Create the pending transaction in the database
      const { data: txData, error: txError } = await supabase.from('transactions').insert({
        wallet_id: wallet.id,
        amount: depositAmount / nairaRate,
        type: 'deposit',
        status: 'pending',
        reference: reference
      }).select('id').single();
      
      if (txError) {
        console.error('Transaction creation error:', txError);
        throw new Error(`Failed to create transaction: ${txError.message}`);
      }
      
      console.log('Created transaction:', txData);
      
      // Now call the Paystack function with the reference
      const response = await supabase.functions.invoke('paystack', {
        body: { 
          amount: depositAmount,
          email: user.email,
          type: 'deposit',
          reference: reference
        },
      });

      console.log('Paystack response:', response);
      
      if (!response.data || !response.data.status) {
        throw new Error('Payment initialization failed');
      }

      // Redirect to payment URL
      window.location.href = response?.data?.data?.authorization_url || '';
    } catch (error) {
      console.error('Deposit error:', error);
      toast({
        title: 'Payment Error',
        description: 'Failed to process payment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const verifyAccount = async () => {
    if (!accountNumber || !bankCode) {
      toast({
        title: 'Error',
        description: 'Please enter your account number and select a bank',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
        headers: {
          'Authorization': `Bearer pk_test_00acd6143e3f8ee868181cefcaa6d65afd649a5a`
        }
      });
      
      const data = await response.json();
      if (data.status) {
        setAccountName(data.data.account_name);
        toast({
          title: 'Success',
          description: 'Account verified successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Unable to verify account',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to verify account',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleWithdrawal = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to make a withdrawal',
        variant: 'destructive',
      });
      return;
    }

    try {
      const withdrawalAmount = Number(amount);
      if (isNaN(withdrawalAmount) || withdrawalAmount < minWithdrawal) {
        throw new Error(`Minimum withdrawal amount is ₦${minWithdrawal.toLocaleString()}`);
      }

      const coins = withdrawalAmount / nairaRate;
      if (wallet?.balance && coins > wallet.balance) {
        throw new Error('Insufficient coins for withdrawal');
      }

      if (!accountNumber || !bankCode || !accountName) {
        throw new Error('Please verify your account details first');
      }

      // Check and create a wallet if needed
      if (!wallet?.id || wallet.id.startsWith('temp-')) {
        console.log('Trying to create or refresh wallet before proceeding with withdrawal');
        await refetchWallet();
      }
      
      // Create the withdrawal transaction
      const { data: txData, error: txError } = await supabase.from('transactions').insert({
        wallet_id: wallet.id,
        amount: coins,
        type: 'withdrawal',
        status: 'processing',
        payout_details: {
          account_number: accountNumber,
          bank_code: bankCode,
          account_name: accountName
        }
      }).select('id').single();
      
      if (txError) {
        throw new Error(`Failed to create transaction: ${txError.message}`);
      }
      
      // Call the Paystack function
      const response = await supabase.functions.invoke('paystack', {
        body: { 
          amount: withdrawalAmount,
          email: user.email,
          type: 'withdrawal',
          accountNumber,
          bankCode,
          transactionId: txData.id
        },
      });

      if (!response?.data?.status) {
        // Update transaction to failed status
        await supabase.from('transactions')
          .update({ status: 'failed' })
          .eq('id', txData.id);
          
        throw new Error('Failed to process withdrawal');
      }

      // Update the wallet balance
      await supabase.from('wallets').update({
        balance: (wallet?.balance || 0) - coins,
        updated_at: new Date().toISOString()
      }).eq('id', wallet?.id);

      toast({
        title: 'Success',
        description: 'Withdrawal request submitted successfully',
      });
      
      setAmount('');
      setIsWithdrawalOpen(false);
      setAccountNumber('');
      setBankCode('');
      setAccountName('');
      
      // Refresh the data
      refetchWallet();
      refetchTransactions();
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  // Show loading state
  if (walletLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-chess-accent"></div>
        <span className="ml-3">Loading wallet...</span>
      </div>
    );
  }

  // Show error state
  if (walletError && !wallet) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <WalletIcon className="h-7 w-7" /> Wallet
          </h1>
          <Button 
            onClick={handleRefreshWallet} 
            variant="outline" 
            size="sm"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
        
        <Card className="border-red-600/50 bg-red-900/20">
          <CardContent className="p-6">
            <h3 className="text-red-500 font-semibold text-lg mb-2">Error Loading Wallet</h3>
            <p className="text-red-400/80 mb-4">
              We encountered an issue while loading your wallet. This could be due to a network issue or a problem with your account.
            </p>
            <Button onClick={handleRefreshWallet} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <WalletIcon className="h-7 w-7" /> Wallet
        </h1>
        <Button 
          onClick={handleRefreshWallet} 
          variant="outline" 
          size="sm"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>
      
      {wallet?.is_demo && (
        <Card className="border-yellow-600/50 bg-yellow-900/20">
          <CardContent className="p-6">
            <h3 className="text-yellow-500 font-semibold text-lg mb-2">Demo Account</h3>
            <p className="text-yellow-400/80">
              This is a demo account. While you can practice with demo coins, they cannot be used in real matches. 
              To play real matches, please create a regular account.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="balance">Balance & Transactions</TabsTrigger>
          <TabsTrigger value="info">Coin Information</TabsTrigger>
        </TabsList>
        
        <TabsContent value="balance" className="space-y-6">
          <Card className="border-chess-brown/50 bg-chess-dark/90">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Balance
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRefreshWallet}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                </Button>
              </CardTitle>
              <CardDescription>Your current balance and transaction options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-2xl font-bold">
                  {`${wallet?.balance?.toFixed(2) || 0} coins`}
                </div>

                {!wallet?.is_demo && (
                  <TransactionForm
                    transactionType={transactionType}
                    setTransactionType={setTransactionType}
                    amount={amount}
                    setAmount={setAmount}
                    handleDeposit={handleDeposit}
                    setIsWithdrawalOpen={setIsWithdrawalOpen}
                    minAmount={transactionType === 'deposit' ? minDeposit : minWithdrawal}
                    nairaRate={nairaRate}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-chess-brown/50 bg-chess-dark/90">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Your recent deposits and withdrawals</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionHistory 
                transactions={transactions} 
                isLoading={transactionsLoading}
                nairaRate={nairaRate}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="info">
          <CoinConversionInfo />
        </TabsContent>
      </Tabs>

      <WithdrawalDialog 
        isOpen={isWithdrawalOpen}
        onOpenChange={setIsWithdrawalOpen}
        amount={amount}
        bankCode={bankCode}
        setBankCode={setBankCode}
        accountNumber={accountNumber}
        setAccountNumber={setAccountNumber}
        accountName={accountName}
        isVerifying={isVerifying}
        verifyAccount={verifyAccount}
        handleWithdrawal={handleWithdrawal}
        banks={banks || []}
      />
    </div>
  );
};

export default WalletPage;
