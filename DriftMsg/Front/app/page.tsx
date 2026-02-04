'use client'
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { getUserProfile, getUserDriftBottleCount, getUserDriftBottles, getBottleCreator } from '@/contracts/query'
import { createBottle, pickBottle, throwBottle, replyAndSendToCreator } from '@/contracts/transactions'
import { Send, Anchor, MessageCircle } from 'lucide-react'
import { SuiTransactionBlockResponse } from '@mysten/sui/client'
import { CategorizedObjects } from '@/utils/assetsHelpers'

export default function Home() {
  const account = useCurrentAccount();
  const [userObjects, setUserObjects] = useState<CategorizedObjects | null>(null);
  const [driftBottleCount, setDriftBottleCount] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [pickedBottles, setPickedBottles] = useState<{ 
    id: string; 
    message: string; 
    replies: string[];
  }[]>([]);
  const [replyInputs, setReplyInputs] = useState<{ [key: string]: string }>({});
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  useEffect(() => {
    async function fetchUserProfile() {
      if (account?.address) {
        try {
          const profile = await getUserProfile(account.address);
          setUserObjects(profile);
          
          // 并行获取DriftBottle数量和详细信息
          const [bottleCount, userBottles] = await Promise.all([
            getUserDriftBottleCount(account.address),
            getUserDriftBottles(account.address)
          ]);
          
          setDriftBottleCount(bottleCount);
          setPickedBottles(userBottles);
          
          console.log(`用户 ${account.address} 加载完成:`);
          console.log(`- 拥有 ${bottleCount} 个漂流瓶`);
          console.log(`- 详细信息:`, userBottles);
        } catch (error) {
          console.error('获取用户资料失败:', error);
          // 设置默认值以避免UI错误
          setDriftBottleCount(0);
          setPickedBottles([]);
        }
      } else {
        // 用户未连接时重置状态
        setDriftBottleCount(0);
        setPickedBottles([]);
        setUserObjects(null);
      }
    }

    fetchUserProfile();
  }, [account]);

  // 优化的瓶子计数更新effect
  useEffect(() => {
    let isMounted = true;
    
    const updateBottleCount = async () => {
      if (!account?.address || !isMounted) return;
      
      try {
        // 添加短暂延迟确保链上状态已更新
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (!isMounted) return;
        
        const bottleCount = await getUserDriftBottleCount(account.address);
        setDriftBottleCount(bottleCount);
        console.log('瓶子计数已更新为:', bottleCount);
      } catch (error) {
        console.error('更新瓶子计数失败:', error);
      }
    };
    
    // 只有在真正需要时才更新计数
    if (pickedBottles.length > 0) {
      updateBottleCount();
    }
    
    return () => {
      isMounted = false;
    };
  }, [pickedBottles.length, account?.address]); // 依赖数组优化

  const handleThrowBottle = async () => {
    // 验证消息不为空
    if (!message || !message.trim()) {
      alert('请输入漂流瓶消息内容！');
      return;
    }
    
    // 验证消息长度（可选的额外验证）
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 1) {
      alert('消息内容不能为空！');
      return;
    }
    
    // 可选：添加最大长度限制
    if (trimmedMessage.length > 500) {
      alert('消息内容过长，请控制在500字符以内！');
      return;
    }
    
    try {
      const tx = createBottle(trimmedMessage);
      // @ts-expect-error Dependency version conflict
      signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          alert('漂流瓶投掷成功！');
          setMessage('');
          
          // 更新瓶子计数
          if (account?.address) {
            try {
              const bottleCount = await getUserDriftBottleCount(account.address);
              setDriftBottleCount(bottleCount);
            } catch (error) {
              console.error('Error updating bottle count:', error);
            }
          }
        },
        onError: (error) => {
          console.error('Error throwing bottle:', error);
          alert('投掷漂流瓶失败，请重试');
        },
      });
    } catch (error) {
      console.error('Error:', error);
      alert('投掷漂流瓶失败，请重试');
    }
  };

  const handlePickBottle = async () => {
    if (!account) {
      alert('请先连接钱包');
      return;
    }
    
    console.log('开始拾取漂流瓶...');
    try {
      const tx = pickBottle();
      console.log('交易已创建:', tx);
      
      // @ts-expect-error Dependency version conflict
      signAndExecute({ transaction: tx }, {
        onSuccess: async (result: SuiTransactionBlockResponse) => {
          console.log('拾取漂流瓶成功:', result);
        },
        onError: (error) => {
          console.error('Error picking bottle:', error);
          alert('拾取漂流瓶失败，请重试');
        },
      });
    } catch (error) {
      console.error('Error:', error);
      alert('拾取漂流瓶失败，请重试');
    }

  };

  // 丢回海里的功能 - 调用throw_bottle方法将瓶子重新投放到海洋中
  const handleThrowBackToSea = async (bottleId: string) => {
    try {
      // 验证必要的环境变量
      const poolId = process.env.NEXT_PUBLIC_POOL_ID;
      if (!poolId) {
        alert('系统配置错误：缺少POOL_ID');
        return;
      }

      // 构建交易 - 调用throw_bottle方法
      const tx = throwBottle(bottleId, poolId);
      
      // @ts-expect-error Dependency version conflict
      signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          alert('漂流瓶已成功丢回海里！');
          // 从已捡起的瓶子列表中移除
          setPickedBottles((prev: Array<{ id: string; message: string; replies: string[] }>) => prev.filter(bottle => bottle.id !== bottleId));
          setReplyInputs(prev => ({ ...prev, [bottleId]: '' }));
          
          // 更新瓶子计数
          if (account?.address) {
            try {
              const bottleCount = await getUserDriftBottleCount(account.address);
              setDriftBottleCount(bottleCount);
            } catch (error) {
              console.error('Error updating bottle count:', error);
            }
          }
        },
        onError: (error) => {
          console.error('Error throwing bottle back to sea:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert(`丢回海里失败: ${errorMessage}`);
        },
      });
    } catch (error) {
      console.error('Error in handleThrowBackToSea:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`丢回海里失败: ${errorMessage}`);
    }
  };

  // 回复并发送给原创建者的功能
  const handleReplyAndSendToCreator = async (bottleId: string) => {
    const replyMessage = replyInputs[bottleId];
    if (!replyMessage?.trim()) return;
    
    try {
      // 在回复时查询发送者地址
      const creatorAddress = await getBottleCreator(bottleId);
      
      if (!creatorAddress) {
        alert('无法找到原发送者地址');
        return;
      }
      
      const tx = replyAndSendToCreator(bottleId, replyMessage, creatorAddress);
      
      // @ts-expect-error Dependency version conflict
      signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          alert('回复已发送给原发送者！');
          // 从已捡起的瓶子列表中移除（因为已经发送回去了）
          setPickedBottles((prev: Array<{ id: string; message: string; replies: string[] }>) => prev.filter(bottle => bottle.id !== bottleId));
          setReplyInputs(prev => ({ ...prev, [bottleId]: '' }));
          
          // 更新瓶子计数
          if (account?.address) {
            try {
              const bottleCount = await getUserDriftBottleCount(account.address);
              setDriftBottleCount(bottleCount);
            } catch (error) {
              console.error('Error updating bottle count:', error);
            }
          }
        },

        onError: (error) => {
          console.error('Error replying and sending to creator:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert(`回复发送失败: ${errorMessage}`);
        },
      });
    } catch (error) {
      console.error('Error in handleReplyAndSendToCreator:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`回复发送失败: ${errorMessage}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-4 bg-white shadow-md">
        <div className="flex items-center rounded-full overflow-hidden">
          <Image src="/logo/drift-bottle-logo.svg" alt="Drift Bottle Logo" width={80} height={40} />
        </div>
        <ConnectButton />
      </header>
      {userObjects!=null ? (
      <main className="flex-grow flex flex-col items-center p-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">🌊 Drift Bottle</h1>
          <p className="text-xl text-gray-600">Send messages across the digital ocean</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full mb-8">
          {/* Throw Bottle Section */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-blue-500 p-2 rounded-full mr-3">
                <Send className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Throw a Bottle</h2>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="写下你想传递的秘密消息..."
              className={`w-full h-32 p-3 border-2 rounded-lg resize-none focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 text-gray-700 text-sm ${
                !message.trim() && message.length > 0 
                  ? 'border-red-300 bg-red-50' 
                  : message.trim() 
                    ? 'border-blue-200 focus:border-blue-500' 
                    : 'border-gray-200'
              }`}
            />
            
            {/* 实时验证提示 */}
            <div className="mt-2 text-sm">
              {!message.trim() && message.length > 0 && (
                <p className="text-red-500 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  请输入有效的消息内容
                </p>
              )}
              {message.trim() && message.trim().length > 500 && (
                <p className="text-orange-500 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  消息较长，建议控制在500字符以内
                </p>
              )}
              {message.trim() && message.trim().length <= 500 && (
                <p className="text-green-500 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  消息格式正确
                </p>
              )}
            </div>
            
            <button
              onClick={handleThrowBottle}
              disabled={!message.trim()}
              className={`mt-4 w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center text-sm ${
                message.trim()
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md hover:scale-105 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4 mr-1" />
              {message.trim() ? 'Send to Sea' : '请输入消息内容'}
            </button>
          </div>

          {/* Pick Bottle Section */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-green-500 p-2 rounded-full mr-3">
                <Anchor className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Pick a Bottle</h2>
            </div>
            <button
              onClick={handlePickBottle}
              className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md flex items-center justify-center mb-4 text-sm"
            >
              <Anchor className="w-4 h-4 mr-1" />
              Fish from Ocean
            </button>
            <p className="text-center text-gray-600 mb-3 text-sm">
              捡瓶子数量: <span className="font-bold text-green-600">{driftBottleCount}</span>
            </p>
            
            {/* 瓶子列表展示区域 */}
            {pickedBottles.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {pickedBottles.map((bottle, index) => (
                  <div key={bottle.id} className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200">
                    {/* 瓶子头部 - 图标和基本信息 */}
                    <div className="flex items-center mb-3">
                      <MessageCircle className="w-5 h-5 text-yellow-600 mr-2" />
                      <span className="text-sm font-semibold text-yellow-800">Bottle #{index + 1}</span>
                    </div>
                    <p className="text-gray-800 italic mb-4">&quot;{bottle.message}&quot;</p>
                    {bottle.replies.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-yellow-800 mb-2">Replies:</h4>
                        {bottle.replies.map((reply, replyIndex) => (
                          <p key={replyIndex} className="text-gray-700 text-sm italic mb-1">&quot;{reply}&quot;</p>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={replyInputs[bottle.id] || ''}
                        onChange={(e) => setReplyInputs(prev => ({ ...prev, [bottle.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="w-full p-2 border border-yellow-300 rounded-lg text-gray-700"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReplyAndSendToCreator(bottle.id)}
                          className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 flex-1"
                        >
                          回复并发送
                        </button>
                        <button
                          onClick={() => handleThrowBackToSea(bottle.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200"
                        >
                          丢回海里
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* {userObjects && (
          <div className="w-full max-w-6xl">
            <h2 className="text-2xl font-bold mb-4">Your Assets</h2>
            
            <div className="flex gap-8">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Coins</h3>
                {Object.entries(userObjects.coins).map(([coinType, coins]) => {
                  const totalBalance = calculateTotalBalance(coins);
                  return (
                    <div key={coinType} className="mb-4 p-4 bg-gray-100 rounded-lg">
                      <h4 className="font-medium text-lg">{coinType.split('::').pop()}</h4>
                      <p>Count: {coins.length}</p>
                      <p>Total Balance: {formatBalance(totalBalance)}</p>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Other Objects</h3>
                <div className="h-[500px] overflow-y-auto pr-4">
                  {Object.entries(userObjects.objects).map(([objectType, objects]) => (
                    <div key={objectType} className="mb-4 p-4 bg-gray-100 rounded-lg">
                      <h4 className="font-medium text-lg">{objectType.split('::').pop()}</h4>
                      <p>Count: {objects.length}</p>
                      <p className="text-gray-500 text-sm">{objectType.split('::').pop()}</p>
                      <p className="text-gray-500 text-sm">{objectType.split('::')[0]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )} */}
      </main>
      ):(
        <div className="flex-grow flex flex-col items-center p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-8">Welcome to Nextjs Sui Dapp Template</h1>
          <h3 className="text-2xl font-bold text-gray-800 mb-8">Please connect your wallet to view your assets</h3>
        </div>        
      )}
    </div>
  );
}