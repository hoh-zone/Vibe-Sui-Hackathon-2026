import { Transaction } from "@mysten/sui/transactions";

export function createBottle(message: string): Transaction {
  const tx = new Transaction();

  // Create and throw the bottle in one call
  tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::driftmsg::create_and_throw_bottle`,
    arguments: [
      tx.pure.string(message),
      tx.object(process.env.NEXT_PUBLIC_POOL_ID!),
    ],
  });

  return tx;
}

export function pickBottle(): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::driftmsg::pick_bottle`,
    arguments: [
      tx.object(process.env.NEXT_PUBLIC_POOL_ID!),
    ],
  });

  return tx;
}

export function replyBottle(bottleId: string, replyMessage: string): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::driftmsg::reply_to_bottle_default`,
    arguments: [
      tx.object(bottleId),
      tx.pure.string(replyMessage),
    ],
  });

  return tx;
}

export function replyAndSendToCreator(bottleId: string, replyMessage: string, creatorAddress: string): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::driftmsg::reply_and_send_to_creator`,
    arguments: [
      tx.object(bottleId),  // The bottle object
      tx.pure.string(replyMessage),  // The reply message
      tx.pure.address(creatorAddress),  // The creator's address
    ],
  });

  return tx;
}

export function throwBottle(bottleId: string, poolId: string): Transaction {
  const tx = new Transaction();
  
  // First, get the bottle object
  const bottle = tx.object(bottleId);
  
  // Then call throw_bottle
  tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::driftmsg::throw_bottle`,
    arguments: [
      tx.object(poolId),
      bottle,
    ],
  });

  return tx;
}