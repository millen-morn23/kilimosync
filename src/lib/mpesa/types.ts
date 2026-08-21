export type StkPushResult =
  | { ok: true; merchantRequestId: string; checkoutRequestId: string }
  | { ok: false; error: string };

export type DarajaCallbackMetadataItem = {
  Name: string;
  Value?: string | number;
};

export type DarajaStkCallback = {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: DarajaCallbackMetadataItem[];
      };
    };
  };
};

export type ParsedCallback = {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount: number | null;
  mpesaReceiptNumber: string | null;
  transactionDate: string | null;
  phoneNumber: string | null;
};
