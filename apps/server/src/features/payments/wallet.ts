import { HDNodeWallet, getAddress, type HDNodeVoidWallet } from "ethers";

type DeriveAddressInput = {
  readonly xpub: string;
  readonly derivationIndex: number;
};

type DeriveAddressResult = {
  readonly address: string;
  readonly derivationIndex: number;
};

export function deriveAddress(input: DeriveAddressInput): DeriveAddressResult {
  const node: HDNodeWallet | HDNodeVoidWallet = HDNodeWallet.fromExtendedKey(input.xpub);
  const child: HDNodeWallet | HDNodeVoidWallet = node.deriveChild(input.derivationIndex);
  const address: string = getAddress(child.address);
  return { address, derivationIndex: input.derivationIndex };
}
