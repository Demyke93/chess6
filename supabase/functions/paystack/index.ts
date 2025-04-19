
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Use the secret key you provided
  const PAYSTACK_SECRET_KEY = 'sk_test_15e8f8988e2fb1529ab6f0584fceb3dcc903d92d'
  if (!PAYSTACK_SECRET_KEY) {
    return new Response(JSON.stringify({ 
      status: false, 
      message: "Paystack API key not configured" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const url = new URL(req.url);
    
    // Handle webhook events from Paystack
    if (url.pathname.endsWith('/webhook') && req.method === 'POST') {
      // Verify webhook signature
      const hash = req.headers.get('x-paystack-signature');
      const body = await req.text();
      
      console.log("Received webhook from Paystack:", body);
      
      try {
        const event = JSON.parse(body);
        const { event: eventType, data } = event;
        
        console.log("Processing event type:", eventType);
        
        // Handle successful charge events
        if (eventType === 'charge.success') {
          const { reference, amount, customer, status } = data;
          
          if (status === 'success') {
            // Create a client with the service role key to bypass RLS
            const supabaseAdminClient = createClient(
              Deno.env.get('SUPABASE_URL') || '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
              { auth: { persistSession: false } }
            );
            
            // Find the transaction using the reference
            const { data: transactionData, error: transactionError } = await supabaseAdminClient
              .from('transactions')
              .select('*')
              .eq('reference', reference)
              .single();
              
            if (transactionError) {
              console.error("Error finding transaction:", transactionError);
              throw transactionError;
            }
            
            if (!transactionData) {
              console.error("Transaction not found for reference:", reference);
              throw new Error("Transaction not found");
            }
            
            const walletId = transactionData.wallet_id;
            
            // Update the wallet balance
            const { data: walletData, error: walletError } = await supabaseAdminClient
              .from('wallets')
              .select('balance')
              .eq('id', walletId)
              .single();
              
            if (walletError) {
              console.error("Error finding wallet:", walletError);
              throw walletError;
            }
            
            const newBalance = walletData.balance + transactionData.amount;
            
            const { error: updateError } = await supabaseAdminClient
              .from('wallets')
              .update({ 
                balance: newBalance,
                updated_at: new Date().toISOString()
              })
              .eq('id', walletId);
              
            if (updateError) {
              console.error("Error updating wallet balance:", updateError);
              throw updateError;
            }
            
            // Update transaction status
            const { error: txUpdateError } = await supabaseAdminClient
              .from('transactions')
              .update({ 
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', transactionData.id);
              
            if (txUpdateError) {
              console.error("Error updating transaction status:", txUpdateError);
              throw txUpdateError;
            }
            
            console.log("Successfully processed payment and updated wallet");
          }
        }
        
        // Return 200 to acknowledge receipt
        return new Response(JSON.stringify({ status: "success" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (webhookError) {
        console.error("Error processing webhook:", webhookError);
        return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    } 
    // Handle regular API calls
    else {
      let body;
      try {
        body = await req.json();
      } catch (err) {
        body = {
          amount: 0,
          email: '',
          type: 'deposit'
        };
      }
      
      const { amount, email, type, accountNumber, bankCode } = body;
      
      if (!amount || !email) {
        return new Response(JSON.stringify({ 
          status: false,
          message: "Missing required fields: amount and email are required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      if (type === 'withdrawal') {
        // First create a transfer recipient
        const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: "nuban",
            name: email,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: "NGN"
          })
        })

        const recipientData = await recipientResponse.json()
        
        if (!recipientData.status) {
          throw new Error(recipientData.message || 'Failed to create transfer recipient')
        }
        
        // Now initiate the transfer
        const transferResponse = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: 'balance',
            amount: amount * 100, // Convert to kobo
            recipient: recipientData.data.recipient_code,
            reason: 'Withdrawal from ChessStake'
          })
        })

        const transferData = await transferResponse.json()
        return new Response(JSON.stringify(transferData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        // Generate a unique reference
        const reference = body.reference || `chess_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        
        // Handle deposits by initializing a payment
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            amount: amount * 100, // Convert to kobo
            callback_url: `${req.headers.get('origin')}/wallet`,
            reference
          })
        })

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  } catch (error) {
    console.error("Error in Paystack function:", error);
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message || "An unexpected error occurred" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
