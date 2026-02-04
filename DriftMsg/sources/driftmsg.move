/// Module: driftmsg
module driftmsg::driftmsg;

use sui::object::{Self, UID, ID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use sui::event;
use sui::vec_set::{Self, VecSet};
use sui::dynamic_object_field as dof;
use std::vector;
use std::string::{Self, String};

// Default TTL for messages: 7 days in milliseconds
const DEFAULT_TTL_MS: u64 = 604800000;

/// A drift bottle containing a message that can float in the ocean
public struct DriftBottle has key, store {
    id: UID,
    message: String,  // Direct message content
    replies: vector<Reply>,
    expiry: u64,  // Expiry timestamp in milliseconds
}

// Struct for a Reply
public struct Reply has store, drop {
    replier: address,
    reply: String,  // Direct reply content
    expiry: u64,  // Expiry timestamp in milliseconds
}

// Shared object to hold all thrown bottles
public struct BottlePool has key {
    id: UID,
    bottles: VecSet<ID>,
}

// Events
public struct BottleCreated has copy, drop {
    bottle_id: ID,
    creator: address,
    message: String,
    expiry: u64,
}

public struct BottleThrown has copy, drop {
    bottle_id: ID,
}

public struct BottlePicked has copy, drop {
    bottle_id: ID,
    picker: address,
}

public struct ReplyAdded has copy, drop {
    bottle_id: ID,
    replier: address,
}

// Initialize the module
fun init(ctx: &mut TxContext) {
    let pool = BottlePool {
        id: object::new(ctx),
        bottles: vec_set::empty(),
    };
    transfer::share_object(pool);
}

// Create a new drift bottle with custom TTL
public fun create_bottle(message: String, ttl_ms: u64, ctx: &mut TxContext): DriftBottle {
    let expiry = tx_context::epoch_timestamp_ms(ctx) + ttl_ms;
    let bottle = DriftBottle {
        id: object::new(ctx),
        message,
        replies: vector::empty(),
        expiry,
    };
    
    event::emit(BottleCreated {
        bottle_id: object::uid_to_inner(&bottle.id),
        creator: tx_context::sender(ctx),
        message: message,
        expiry: expiry,
    });
    
    bottle
}

// Create a new drift bottle with default TTL (24 hours)
public fun create_bottle_default(message: String, ctx: &mut TxContext): DriftBottle {
    create_bottle(message, 24 * 60 * 60 * 1000, ctx)
}

/// Create a bottle and immediately throw it into the ocean (entry function)
public entry fun create_and_throw_bottle(message: String, pool: &mut BottlePool, ctx: &mut TxContext) {
    let bottle = create_bottle(message, 24 * 60 * 60 * 1000, ctx);
    throw_bottle(pool, bottle, ctx);
}

// Throw a bottle into the pool
public entry fun throw_bottle(pool: &mut BottlePool, bottle: DriftBottle, _ctx: &mut TxContext) {
    let bottle_id = object::uid_to_inner(&bottle.id);
    vec_set::insert(&mut pool.bottles, bottle_id);
    dof::add(&mut pool.id, bottle_id, bottle);
    event::emit(BottleThrown { bottle_id });
}

// Pick a random bottle from the pool
public entry fun pick_bottle(pool: &mut BottlePool, ctx: &mut TxContext) {
    assert!(!vec_set::is_empty(&pool.bottles), 0);
    let keys = vec_set::keys(&pool.bottles);
    let bottle_id = *vector::borrow(keys, 0);  // Pick the first one for simplicity; in production, use random
    vec_set::remove(&mut pool.bottles, &bottle_id);
    let bottle: DriftBottle = dof::remove(&mut pool.id, bottle_id);
    event::emit(BottlePicked {
        bottle_id,
        picker: tx_context::sender(ctx),
    });
    transfer::public_transfer(bottle, tx_context::sender(ctx));
}

// Reply to a bottle with a reply
public fun reply_to_bottle(bottle: &mut DriftBottle, reply: String, ttl_ms: u64, ctx: &mut TxContext) {
    let expiry = tx_context::epoch_timestamp_ms(ctx) + ttl_ms;
    let reply_struct = Reply {
        replier: tx_context::sender(ctx),
        reply,
        expiry,
    };
    vector::push_back(&mut bottle.replies, reply_struct);
    event::emit(ReplyAdded {
        bottle_id: object::uid_to_inner(&bottle.id),
        replier: tx_context::sender(ctx),
    });
}

// Reply to a bottle with default TTL
public entry fun reply_to_bottle_default(bottle: &mut DriftBottle, reply: String, ctx: &mut TxContext) {
    reply_to_bottle(bottle, reply, DEFAULT_TTL_MS, ctx)
}

// Reply to a bottle and send it to the original creator
public entry fun reply_and_send_to_creator(
    bottle: DriftBottle, 
    reply: String, 
    creator_address: address,
    ctx: &mut TxContext
) {
    let mut bottle = bottle;
    // Add the reply to the bottle
    let expiry = tx_context::epoch_timestamp_ms(ctx) + DEFAULT_TTL_MS;
    let reply_struct = Reply {
        replier: tx_context::sender(ctx),
        reply,
        expiry,
    };
    vector::push_back(&mut bottle.replies, reply_struct);
    
    // Emit reply event
    event::emit(ReplyAdded {
        bottle_id: object::uid_to_inner(&bottle.id),
        replier: tx_context::sender(ctx),
    });
    
    // Transfer the bottle to the original creator
    transfer::public_transfer(bottle, creator_address);
}

// Get message from bottle
public fun get_message(bottle: &DriftBottle): &String {
    &bottle.message
}

// Get replies
public fun get_replies(bottle: &DriftBottle): &vector<Reply> {
    &bottle.replies
}

// Get reply content
public fun get_reply_content(reply: &Reply): &String {
    &reply.reply
}

// Get expiry of bottle
public fun get_bottle_expiry(bottle: &DriftBottle): u64 {
    bottle.expiry
}

// Get expiry of reply
public fun get_reply_expiry(reply: &Reply): u64 {
    reply.expiry
}

#[test_only]
public fun init_for_test(ctx: &mut TxContext) {
    transfer::share_object(BottlePool {
        id: object::new(ctx),
        bottles: vec_set::empty(),
    });
}

