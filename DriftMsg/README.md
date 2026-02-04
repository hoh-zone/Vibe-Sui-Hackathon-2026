# DriftMsg - Sui Drift Bottle Project

A decentralized drift bottle application built on Sui blockchain, inspired by WeChat's drift bottle feature. Users can throw messages into a virtual sea and pick up messages from others, with replies functionality. Messages are stored directly on-chain as strings.

## Features

- **Throw Bottles**: Create and throw drift bottles containing messages
- **Pick Bottles**: Randomly pick up bottles thrown by others
- **Reply to Bottles**: Add replies to picked bottles
- **On-chain Storage**: Messages and replies are stored directly as strings on the Sui blockchain
- **Events**: Emits events for bottle creation, throwing, picking, and replying

## Architecture

### Smart Contracts

- **DriftBottle**: Represents a drift bottle with message content and replies
- **Reply**: Contains replier address and reply content
- **BottlePool**: Shared object managing all thrown bottles using VecSet and dynamic object fields

### Key Functions

- `create_bottle(message: String)`: Create a new bottle with a message string
- `throw_bottle(pool: &mut BottlePool, bottle: DriftBottle)`: Throw bottle into the pool
- `pick_bottle(pool: &mut BottlePool)`: Pick a random bottle from the pool (transfers to caller)
- `reply_to_bottle(bottle: &mut DriftBottle, reply: String)`: Add reply to a bottle

## Usage

### Prerequisites

- Sui CLI installed

### Deploy Contract

```bash
cd DriftMsg
sui move build
sui client publish --gas-budget 100000000
```

### Client Integration

1. **Create Bottle**:
   Call `create_bottle("Hello, world!")` to create a bottle object.

2. **Throw Bottle**:
   Call `throw_bottle(pool, bottle)` to add to shared pool.

3. **Pick Bottle**:
   Call `pick_bottle(pool)` to get a random bottle transferred to your address.

4. **Read Message**:
   Get message from `get_message(bottle)`.

5. **Reply**:
   Call `reply_to_bottle(bottle, "Nice reply!")` to add a reply.

## Events

- `BottleCreated`: When a bottle is created
- `BottleThrown`: When a bottle is thrown into the pool
- `BottlePicked`: When a bottle is picked
- `ReplyAdded`: When a reply is added to a bottle

## Testing

Run tests with:
```bash
sui move test
```

## Future Enhancements

- Random bottle selection algorithm
- Expiration of bottles
- Private bottles
- UI frontend

## License

MIT