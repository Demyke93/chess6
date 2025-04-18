
import { Transaction } from '@/hooks/useTransactions';
import { formatDistanceToNow } from 'date-fns';
import { ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type TransactionStatusIcon = {
  [key: string]: JSX.Element;
};

const statusIcons: TransactionStatusIcon = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  processing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />
};

const statusClasses = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  processing: "bg-blue-500/10 text-blue-600 border-blue-200",
  completed: "bg-green-500/10 text-green-600 border-green-200",
  failed: "bg-red-500/10 text-red-600 border-red-200"
};

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading: boolean;
  nairaRate: number;
}

export const TransactionHistory = ({ transactions, isLoading, nairaRate }: TransactionHistoryProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-chess-accent" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No transactions found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center p-4 rounded-lg bg-chess-dark/50 border border-chess-brown/30">
          <div className="mr-4 p-2 rounded-full bg-chess-dark border border-chess-brown/50">
            {transaction.type === 'deposit' ? (
              <ArrowUpFromLine className="h-5 w-5 text-green-500" />
            ) : (
              <ArrowDownToLine className="h-5 w-5 text-amber-500" />
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold capitalize">{transaction.type}</h4>
                <p className="text-sm text-gray-400">
                  {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${transaction.type === 'deposit' ? 'text-green-500' : 'text-amber-500'}`}>
                  {transaction.type === 'deposit' ? '+' : '-'}{transaction.amount.toFixed(2)} coins
                </p>
                <p className="text-xs text-gray-400">≈ ₦{(transaction.amount * nairaRate).toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="ml-4">
            <span className={`px-2 py-1 rounded-full text-xs border ${statusClasses[transaction.status] || ''} flex items-center gap-1`}>
              {statusIcons[transaction.status] || <Clock className="h-4 w-4" />}
              <span>{transaction.status}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
