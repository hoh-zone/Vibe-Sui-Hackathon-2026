#[test_only]
module driftmsg::driftmsg_tests;

use sui::test_scenario;
use sui::object;
use sui::transfer;
use sui::vec_set;
use std::string;
use driftmsg::driftmsg::{Self, BottlePool, DriftBottle};

#[test]
fun test_create_and_throw_bottle() {
    let mut scenario = test_scenario::begin(@0x1);
    {
        driftmsg::init_for_test(test_scenario::ctx(&mut scenario));
    };

    test_scenario::next_tx(&mut scenario, @0x1);
    {
        let mut pool = test_scenario::take_shared<BottlePool>(&mut scenario);
        let message = string::utf8(b"Hello, world!");
        let bottle = driftmsg::create_bottle(message, 259200000, test_scenario::ctx(&mut scenario));
        driftmsg::throw_bottle(&mut pool, bottle, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(pool);
    };

    test_scenario::next_tx(&mut scenario, @0x2);
    {
        let mut pool = test_scenario::take_shared<BottlePool>(&mut scenario);
        driftmsg::pick_bottle(&mut pool, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(pool);
    };

    test_scenario::next_tx(&mut scenario, @0x2);
    {
        let picked_bottle = test_scenario::take_from_sender<DriftBottle>(&mut scenario);
        let _message = driftmsg::get_message(&picked_bottle);
        assert!(driftmsg::get_replies(&picked_bottle).length() == 0, 0);
        test_scenario::return_to_sender(&scenario, picked_bottle);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_reply_to_bottle() {
    let mut scenario = test_scenario::begin(@0x1);
    {
        driftmsg::init_for_test(test_scenario::ctx(&mut scenario));
    };

    test_scenario::next_tx(&mut scenario, @0x1);
    {
        let mut pool = test_scenario::take_shared<BottlePool>(&mut scenario);
        let message = string::utf8(b"Hello from the sea!");
        let bottle = driftmsg::create_bottle(message, 259200000, test_scenario::ctx(&mut scenario));
        driftmsg::throw_bottle(&mut pool, bottle, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(pool);
    };

    test_scenario::next_tx(&mut scenario, @0x2);
    {
        let mut pool = test_scenario::take_shared<BottlePool>(&mut scenario);
        driftmsg::pick_bottle(&mut pool, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(pool);
    };

    test_scenario::next_tx(&mut scenario, @0x2);
    {
        let mut picked_bottle = test_scenario::take_from_sender<DriftBottle>(&mut scenario);
        let reply = string::utf8(b"Nice to meet you!");
        driftmsg::reply_to_bottle(&mut picked_bottle, reply, 259200000, test_scenario::ctx(&mut scenario));
        assert!(driftmsg::get_replies(&picked_bottle).length() == 1, 0);
        let replies = driftmsg::get_replies(&picked_bottle);
        let first_reply = vector::borrow(replies, 0);
        let _reply_content = driftmsg::get_reply_content(first_reply);
        test_scenario::return_to_sender(&scenario, picked_bottle);
    };

    test_scenario::end(scenario);
}
