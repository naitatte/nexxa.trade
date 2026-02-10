import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "../mutator";

export type WalletSummary = {
  currency: string;
  availableUsdCents: number;
  reservedUsdCents: number;
  lifetimeEarnedUsdCents: number;
  pendingUsdCents: number;
};

export type WalletTransaction = {
  id: string;
  type: "deposit" | "withdrawal";
  amountUsdCents: number;
  status: string;
  chain: string | null;
  txHash: string | null;
  address: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  amountUsdCents: number;
  currency: string;
  status: string;
  destination: string;
  chain: string | null;
  txHash: string | null;
  adminId: string | null;
  reason: string | null;
  createdAt: string;
  approvedAt: string | null;
  processedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  canceledAt: string | null;
  failedAt: string | null;
};

export type WalletDestination = {
  id: string;
  label: string;
  address: string;
  chain: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export const getWalletSummary = () =>
  customInstance<WalletSummary>({ url: "/api/wallet/summary" });

export const getWalletTransactions = () =>
  customInstance<{ items: WalletTransaction[] }>({
    url: "/api/wallet/transactions",
  });

export const postWithdrawal = (input: {
  amountUsdCents: number;
  destination: string;
  chain?: string | null;
  password: string;
  code?: string;
}) =>
  customInstance<WithdrawalRequest>({
    url: "/api/withdrawals",
    method: "POST",
    data: input,
  });

export const postCancelWithdrawal = (withdrawalId: string) =>
  customInstance<WithdrawalRequest>({
    url: `/api/withdrawals/${withdrawalId}/cancel`,
    method: "POST",
  });

export const getWalletDestinations = () =>
  customInstance<{ items: WalletDestination[] }>({
    url: "/api/wallet/destinations",
  });

export const postWalletDestination = (input: {
  label: string;
  address: string;
  chain?: string | null;
  isDefault?: boolean;
  password: string;
  code?: string;
}) =>
  customInstance<WalletDestination>({
    url: "/api/wallet/destinations",
    method: "POST",
    data: input,
  });

export const deleteWalletDestination = (destinationId: string) =>
  customInstance<{ deletedId: string }>({
    url: `/api/wallet/destinations/${destinationId}`,
    method: "DELETE",
  });

export const postWalletDestinationDefault = (destinationId: string) =>
  customInstance<WalletDestination>({
    url: `/api/wallet/destinations/${destinationId}/default`,
    method: "POST",
  });

export function useWalletSummary() {
  return useQuery({
    queryKey: ["wallet-summary"],
    queryFn: getWalletSummary,
  });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: getWalletTransactions,
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["create-withdrawal"],
    mutationFn: (input: {
      amountUsdCents: number;
      destination: string;
      chain?: string | null;
      password: string;
      code?: string;
    }) => postWithdrawal(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });
}

export function useCancelWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["cancel-withdrawal"],
    mutationFn: ({ withdrawalId }: { withdrawalId: string }) => postCancelWithdrawal(withdrawalId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });
}

export function useWalletDestinations() {
  return useQuery({
    queryKey: ["wallet-destinations"],
    queryFn: getWalletDestinations,
  });
}

export function useCreateWalletDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["create-wallet-destination"],
    mutationFn: (input: { label: string; address: string; chain?: string | null; isDefault?: boolean; password: string; code?: string }) =>
      postWalletDestination(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wallet-destinations"] });
    },
  });
}

export function useDeleteWalletDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["delete-wallet-destination"],
    mutationFn: (input: { destinationId: string }) => deleteWalletDestination(input.destinationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wallet-destinations"] });
    },
  });
}

export function useSetDefaultWalletDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["set-default-wallet-destination"],
    mutationFn: (input: { destinationId: string }) => postWalletDestinationDefault(input.destinationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wallet-destinations"] });
    },
  });
}
