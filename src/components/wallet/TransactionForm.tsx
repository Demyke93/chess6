
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { useState } from "react";

interface TransactionFormProps {
  transactionType: 'deposit' | 'withdraw';
  setTransactionType: (value: 'deposit' | 'withdraw') => void;
  amount: string;
  setAmount: (value: string) => void;
  handleDeposit: () => void;
  setIsWithdrawalOpen: (value: boolean) => void;
  minAmount: number;
  nairaRate: number;
}

export const TransactionForm = ({
  transactionType,
  setTransactionType,
  amount,
  setAmount,
  handleDeposit,
  setIsWithdrawalOpen,
  minAmount,
  nairaRate,
}: TransactionFormProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTransactionAction = async () => {
    if (transactionType === 'deposit') {
      setIsProcessing(true);
      try {
        await handleDeposit();
      } catch (error) {
        console.error("Error processing deposit:", error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setIsWithdrawalOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={transactionType}
        onValueChange={(value) => value && setTransactionType(value as 'deposit' | 'withdraw')}
        className="justify-start"
      >
        <ToggleGroupItem value="deposit" className="flex items-center gap-2">
          <ArrowUpFromLine className="w-4 h-4" />
          Deposit
        </ToggleGroupItem>
        <ToggleGroupItem value="withdraw" className="flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4" />
          Withdraw
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="space-y-2">
        <label className="text-sm font-medium">Amount (₦)</label>
        <div className="flex gap-4">
          <Input
            type="number"
            min={minAmount}
            step="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Minimum: ₦${minAmount.toLocaleString()}`}
          />
          <Button 
            onClick={handleTransactionAction}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : transactionType === 'deposit' ? 'Deposit' : 'Withdraw'}
          </Button>
        </div>
        {amount && !isNaN(Number(amount)) && (
          <p className="text-sm text-gray-400">
            {transactionType === 'deposit' 
              ? `You'll receive ${(Number(amount) / nairaRate).toFixed(2)} coins`
              : `Requires ${(Number(amount) / nairaRate).toFixed(2)} coins from your balance`
            }
          </p>
        )}
      </div>
    </div>
  );
};
