import { isValidSuiAddress } from "@mysten/sui/utils";
import { suiClient } from "./index";
import { SuiObjectResponse } from "@mysten/sui/client";
import { categorizeSuiObjects, CategorizedObjects } from "@/utils/assetsHelpers";

export const getUserProfile = async (address: string): Promise<CategorizedObjects> => {
  if (!isValidSuiAddress(address)) {
    throw new Error("Invalid Sui address");
  }

  let hasNextPage = true;
  let nextCursor: string | null = null;
  let allObjects: SuiObjectResponse[] = [];

  while (hasNextPage) {
    const response = await suiClient.getOwnedObjects({
      owner: address,
      options: {
        showContent: true,
      },
      cursor: nextCursor,
    });

    allObjects = allObjects.concat(response.data);
    hasNextPage = response.hasNextPage;
    nextCursor = response.nextCursor ?? null;
  }

  return categorizeSuiObjects(allObjects);
};

// 获取用户拥有的DriftBottle数量
export const getUserDriftBottleCount = async (address: string): Promise<number> => {
  if (!isValidSuiAddress(address)) {
    throw new Error("Invalid Sui address");
  }

  // 获取合约配置
  const network = process.env.NEXT_PUBLIC_SUI_NETWORK as 'devnet' | 'testnet' | 'mainnet' || 'devnet';
  const packageId = process.env[`NEXT_PUBLIC_${network.toUpperCase()}_PACKAGE_ID`] || process.env.NEXT_PUBLIC_PACKAGE_ID;
  
  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  const driftBottleType = `${packageId}::driftmsg::DriftBottle`;
  
  let hasNextPage = true;
  let nextCursor: string | null = null;
  let driftBottleCount = 0;

  while (hasNextPage) {
    const response = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: driftBottleType
      },
      options: {
        showType: true,
      },
      cursor: nextCursor,
    });

    // 统计DriftBottle对象数量
    driftBottleCount += response.data.length;
    
    hasNextPage = response.hasNextPage;
    nextCursor = response.nextCursor ?? null;
  }

  return driftBottleCount;
};

// 获取用户拥有的所有DriftBottle对象详细信息
export const getUserDriftBottles = async (address: string): Promise<{ id: string; message: string; replies: string[] }[]> => {
  if (!isValidSuiAddress(address)) {
    throw new Error("Invalid Sui address");
  }

  // 获取合约配置
  const network = process.env.NEXT_PUBLIC_SUI_NETWORK as 'devnet' | 'testnet' | 'mainnet' || 'devnet';
  const packageId = process.env[`NEXT_PUBLIC_${network.toUpperCase()}_PACKAGE_ID`] || process.env.NEXT_PUBLIC_PACKAGE_ID;
  
  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  const driftBottleType = `${packageId}::driftmsg::DriftBottle`;
  
  let hasNextPage = true;
  let nextCursor: string | null = null;
  let driftBottles: { id: string; message: string; replies: string[] }[] = [];

  while (hasNextPage) {
    const response = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: driftBottleType
      },
      options: {
        showContent: true,
        showType: true,
      },
      cursor: nextCursor,
    });

    // 处理每个DriftBottle对象
    for (const obj of response.data) {
      if (obj.data?.content?.dataType === 'moveObject') {
        const content = obj.data.content as any;
        const objectId = obj.data.objectId;
        
        try {
          // 查询对象的完整内容
          const fullObject = await suiClient.getObject({
            id: objectId,
            options: { showContent: true },
          });
          
          if (fullObject.data?.content?.dataType === 'moveObject') {
            const fullContent = fullObject.data.content as any;
            console.log(`Processing bottle ${objectId}:`, fullContent.fields);
            
            // 更健壮的消息提取逻辑
            let message = '';
            if (fullContent.fields?.message) {
              message = fullContent.fields.message;
            } else if (fullContent.fields?.content) {
              message = fullContent.fields.content;
            } else if (fullContent.fields?.data) {
              message = fullContent.fields.data;
            } else {
              message = '无法获取消息内容';
              console.warn(`Could not extract message from bottle ${objectId}`, fullContent.fields);
            }
            
            // 处理回复数组
            const rawReplies = fullContent.fields?.replies || [];
            let replyMessages: string[] = [];
            
            if (Array.isArray(rawReplies)) {
              replyMessages = rawReplies
                .map((reply: any) => {
                  if (typeof reply === 'string') return reply;
                  if (reply?.fields?.reply) return reply.fields.reply;
                  if (reply?.reply) return reply.reply;
                  return '';
                })
                .filter(Boolean);
            }
            
            console.log(`Extracted message: "${message}" with ${replyMessages.length} replies`);
            
            driftBottles.push({
              id: objectId,
              message: message,
              replies: replyMessages
            });
          }
        } catch (error) {
          console.error(`Error fetching bottle ${objectId}:`, error);
          // 即使某个瓶子获取失败，也继续处理其他瓶子
        }
      }
    }
    
    hasNextPage = response.hasNextPage;
    nextCursor = response.nextCursor ?? null;
  }

  console.log(`Loaded ${driftBottles.length} bottles for user ${address}`);
  return driftBottles;
};

// 获取瓶子创建事件，从中提取发送者地址
export async function getBottleCreator(bottleId: string): Promise<string | null> {
  try {
    // 查询与该瓶子ID相关的BottleCreated事件
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::driftmsg::BottleCreated`
      },
      limit: 100 // 获取最近100个事件
    });

    // 查找匹配的事件
    const matchingEvent = events.data.find(event => {
      const parsedJson = event.parsedJson as { bottle_id?: string };
      return parsedJson.bottle_id === bottleId;
    });

    if (matchingEvent) {
      const parsedJson = matchingEvent.parsedJson as { creator?: string };
      return parsedJson.creator || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting bottle creator:', error);
    return null;
  }
}

export async function getBottleSender(bottleId: string): Promise<string | null> {
  try {
    const bottleObj = await suiClient.getObject({
      id: bottleId,
      options: { showContent: true },
    });
    
    if (bottleObj.data?.content?.dataType === 'moveObject') {
      const fields = (bottleObj.data.content as any).fields;
      return fields?.sender || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting bottle sender:', error);
    return null;
  }
}
