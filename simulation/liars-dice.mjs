export const FACES = [2, 3, 4, 5, 6];
export const FACE_ORDER = [2, 3, 4, 5, 6, 1];
export const TOTAL_DICE = 10;
export const OPENING_QUANTITY = 3;

export function createRng(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(seed, salt) {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function rollHand(rng) {
  return Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
}

export function hasFiveDifferentFaces(hand) {
  return new Set(hand).size === 5;
}

export function isTwoToSixStraight(hand) {
  return hasFiveDifferentFaces(hand) && !hand.includes(1);
}

export function prepareHand(rng) {
  let hand = rollHand(rng);
  while (hasFiveDifferentFaces(hand)) hand = rollHand(rng);
  return hand;
}

export function exactCount(hand, face) {
  let count = 0;
  for (const die of hand) if (die === face) count += 1;
  return count;
}

export function supportCount(hand, bid) {
  if (bid.zhai || bid.face === 1) return exactCount(hand, bid.face);
  return exactCount(hand, bid.face) + exactCount(hand, 1);
}

export function normalSupport(hand, face) {
  return exactCount(hand, face) + exactCount(hand, 1);
}

export function faceRank(face) {
  return FACE_ORDER.indexOf(face);
}

export function bidKey(bid) {
  return `${bid.quantity}x${bid.face}${bid.zhai ? "z" : "n"}`;
}

export function formatBid(bid) {
  return `${bid.quantity} x ${bid.face}${bid.zhai ? " Zhai" : ""}`;
}

function isHigherWithinMode(candidate, current) {
  return (
    candidate.quantity > current.quantity ||
    (candidate.quantity === current.quantity && faceRank(candidate.face) > faceRank(current.face))
  );
}

export function isLegalRaise(current, candidate, totalDice = TOTAL_DICE) {
  if (!Number.isInteger(candidate.quantity) || !Number.isInteger(candidate.face) || typeof candidate.zhai !== 'boolean') return false;
  if (candidate.quantity < OPENING_QUANTITY || candidate.quantity > totalDice) return false;
  if (candidate.face < 1 || candidate.face > 6) return false;
  if (candidate.face === 1 && !candidate.zhai) return false;

  if (!current) return true;

  if (current.zhai) {
    if (candidate.zhai) return isHigherWithinMode(candidate, current);
    return candidate.quantity >= current.quantity * 2;
  }

  return isHigherWithinMode(candidate, current);
}

const ALL_BIDS = [];
for (let quantity = OPENING_QUANTITY; quantity <= TOTAL_DICE; quantity += 1) {
  for (let face = 1; face <= 6; face += 1) {
    if (face === 1) {
      ALL_BIDS.push(Object.freeze({ quantity, face, zhai: true }));
    } else {
      ALL_BIDS.push(Object.freeze({ quantity, face, zhai: false }));
      ALL_BIDS.push(Object.freeze({ quantity, face, zhai: true }));
    }
  }
}

export function legalRaises(current, totalDice = TOTAL_DICE) {
  return ALL_BIDS.filter((bid) => isLegalRaise(current, bid, totalDice));
}

export function isBidTrue(bid, hands) {
  const total = hands.reduce((sum, hand) => sum + supportCount(hand, bid), 0);
  return total >= bid.quantity;
}

export function playRound({ strategies, hands, starter = 0, seed = 1 }) {
  const actionRngs = [
    createRng(mixSeed(seed, 0xa341316c)),
    createRng(mixSeed(seed, 0xc8013ea4)),
  ];
  const history = [];
  let currentBid = null;
  let player = starter;

  for (let turn = 0; turn < 128; turn += 1) {
    const raises = legalRaises(currentBid);
    const action = strategies[player].decide({
      player,
      hand: hands[player],
      opponentDice: 5,
      currentBid,
      legalRaises: raises,
      history,
      rng: actionRngs[player],
    });

    if (action.type === "challenge") {
      if (!currentBid) throw new Error("A player cannot challenge before the first bid.");
      const trueBid = isBidTrue(currentBid, hands);
      const loser = trueBid ? player : 1 - player;
      return {
        winner: 1 - loser,
        loser,
        challenger: player,
        starter,
        trueBid,
        challengedBid: currentBid,
        actions: history.length + 1,
        bids: history.length,
        history,
      };
    }

    if (action.type !== "bid" || !isLegalRaise(currentBid, action.bid)) {
      throw new Error(`${strategies[player].name} returned an illegal action.`);
    }

    currentBid = action.bid;
    history.push({ player, bid: currentBid });
    player = 1 - player;
  }

  throw new Error("Round exceeded the safety turn limit.");
}
