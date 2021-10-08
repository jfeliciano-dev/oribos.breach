import fetch from "node-fetch";

const MS_SEC = 1000;
const MS_MINUTE = 60 * MS_SEC;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;
const MAX_SNAPSHOT_INTERVAL = 2 * MS_HOUR;
const SNAPSHOTS_FOR_INTERVAL = 20;

const REALM_STATE_CACHE_DURATION = 10 * MS_SEC;

const VERSION_GLOBAL_STATE = 2;
const VERSION_ITEM_STATE = 4;
const VERSION_REALM_STATE = 3;
const VERSION_TOKEN_STATE = 1;
const my = {
  categories: undefined,
  battlePetTypes: {},
  lastRealmState: {},
  lastSnapshotList: {},
  classId: undefined,
  extraFilters: undefined,
  invTypes: undefined,
  subClassId: undefined,
  subClassIds: undefined,
  detailColumn: undefined,
};

function getStatistics(values) {
  let median;
  if (values.length % 2 === 1) {
    median = values[Math.floor(values.length / 2)];
  } else {
    let value1 = values[values.length / 2 - 1];
    let value2 = values[values.length / 2];
    median = Math.round((value1 + value2) / 2);
  }

  let mean;
  let sum = 0;
  values.forEach((value) => (sum += value));
  mean = Math.round(sum / values.length);

  return {
    median: median,
    mean: mean,
  };
}

async function getSnapshotList(realm) {
  return (await fetchSnapshotList())[realm.connectedId] || [];
}

async function fetchSnapshotList() {
  //   if (
  //     my.lastSnapshotList.data &&
  //     my.lastSnapshotList.checked > Date.now() - REALM_STATE_CACHE_DURATION
  //   ) {
  //     return my.lastSnapshotList.data;
  //   }

  const response = await fetch(
    "https://oribos.exchange/data/global/state.bin",
    { mode: "same-origin" }
  );
  if (!response.ok) {
    throw "Unable to get global state";
  }

  //   if (
  //     my.lastSnapshotList.data &&
  //     my.lastSnapshotList.modified === response.headers.get("last-modified")
  //   ) {
  //     my.lastSnapshotList.checked = Date.now();

  //     return my.lastSnapshotList.data;
  //   }
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);

  let offset = 0;
  const read = function (byteCount) {
    let result = offset;
    offset += byteCount;

    return result;
  };

  let version = view.getUint8(read(1));
  switch (version) {
    case VERSION_GLOBAL_STATE:
      break;
    default:
      throw "Unknown data version for global state.";
  }

  /** @type {Object.<ConnectedRealmID, Timestamp[]>} result */
  const result = {};

  // Skip the first timestamp list.
  const firstListLength = view.getUint16(read(2), true);
  offset += firstListLength * (2 + 4);

  // Load the snapshot lists.
  for (
    let remaining = view.getUint16(read(2), true);
    remaining > 0;
    remaining--
  ) {
    let realmId = view.getUint16(read(2), true);
    result[realmId] = [];

    for (
      let realmRemaining = view.getUint16(read(2), true);
      realmRemaining > 0;
      realmRemaining--
    ) {
      result[realmId].push(view.getUint32(read(4), true) * MS_SEC);
    }
    Object.freeze(result[realmId]);
  }
  Object.freeze(result);

  my.lastSnapshotList = {
    modified: response.headers.get("last-modified"),
    checked: Date.now(),
    data: result,
  };
  // we've concluded that snapshot are accurate and correct
  //   console.log(result[3676]);
  //   for (let index = 0; index < result[3676].length; index++) {
  //     const element = result[3676][index];
  //     console.log(index, "  :  ", element);
  //   }
  return result;
}
// item needs to be array with an id, basename
// legendaries need to have a baseid + -ilvl

// ex 178296-210 is a SG Ring 210 ilvl
//  "https://oribos.exchange/data/3676/238/178926-210.bin";

// ex 178296-210 is a SG Ring 210 ilvl
// https://oribos.exchange/data/3676/115/173171.bin;

async function getItemState(realm = "", item = { id: "", basename: "" }) {
  const ITEM_PET_CAGE = FALSE;
  // let basename = Items.stringifyKey({
  //     itemId: item.id,
  //     itemLevel: item.bonusLevel,
  //     itemSuffix: item.bonusSuffix,
  // });
  // const url = [
  //     'data',
  //     useCached ? 'cached' : '',
  //     realm.connectedId,
  //     item.id === ITEM_PET_CAGE ? 'pet' : '',
  //     item.id === ITEM_PET_CAGE ? (item.bonusLevel & 0xFF) : (item.id & 0xFF),
  //     basename + '.bin'
  // ].filter(v => v !== '').join('/');
  const url = [
    "data", //https://oribos.exchange/data <-
    "cached", // / cached
    realm.connectedId, // connectedId????
    item.id === ITEM_PET_CAGE ? "pet" : "", // '' since its not a pet
    item.id === ITEM_PET_CAGE ? item.bonusLevel & 0xff : item.id & 0xff, // item.id /238/
    basename + ".bin", // itemId 178926-210 ''
  ]
    .filter((v) => v !== "")
    .join("/");
  const COPPER_SILVER = 100;

  const url = "https://oribos.exchange/data/3676/238/178926-210.bin";
  const response = await fetch(url, { mode: "same-origin" });
  if (!response.ok) {
    console.log("resonse is not okay");
    return {
      realm: realm,
      item: item,
      snapshot: 0,
      price: 0,
      quantity: 0,
      auctions: [],
      snapshots: [],
      specifics: [],
    };
  }
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);

  let offset = 0;
  const read = function (byteCount) {
    let result = offset;
    offset += byteCount;
    return result;
  };

  let fullModifiers = true;

  const result = {
    realm: {
      category: "United States",
      connectedId: 3676,
      id: 1566,
      name: "Area 52",
      region: "us",
      slug: "area-52",
    },
    item: item,
  };

  let t = view.getUint8(read(1));

  result.snapshot = view.getUint32(read(4), true) * MS_SEC;
  result.price = view.getUint32(read(4), true) * COPPER_SILVER;
  result.quantity = view.getUint32(read(4), true);

  result.auctions = [];
  for (
    let remaining = view.getUint16(read(2), true);
    remaining > 0;
    remaining--
  ) {
    let price = view.getUint32(read(4), true) * COPPER_SILVER;
    let quantity = view.getUint32(read(4), true);
    result.auctions.push({ price: price, quantity: quantity });
  }
  result.auctions.sort((a, b) => a.price - b.price);

  result.specifics = [];
  for (
    let remaining = view.getUint16(read(2), true);
    remaining > 0;
    remaining--
  ) {
    let price = view.getUint32(read(4), true) * COPPER_SILVER;
    let modifiers = {};
    if (fullModifiers) {
      for (
        let remainingModifiers = view.getUint8(read(1));
        remainingModifiers > 0;
        remainingModifiers--
      ) {
        let type = view.getUint16(read(2), true);
        let value = view.getUint32(read(4), true);
        modifiers[type] = value;
      }
    } else {
      let level = view.getUint8(read(1));
      if (level) {
        console.log(level);
        // modifiers[Items.MODIFIER_TYPE_TIMEWALKER_LEVEL] = level;
      }
    }
    let bonuses = [];
    for (
      let remainingBonuses = view.getUint8(read(1));
      remainingBonuses > 0;
      remainingBonuses--
    ) {
      bonuses.push(view.getUint16(read(2), true));
    }
    bonuses.sort((a, b) => a - b);
    result.specifics.push({
      price: price,
      modifiers: modifiers,
      bonuses: bonuses,
    });
  }
  result.specifics.sort((a, b) => a.price - b.price);

  result.snapshots = [];
  let deltas = {};
  let prevDelta;
  for (
    let remaining = view.getUint16(read(2), true);
    remaining > 0;
    remaining--
  ) {
    let snapshot = view.getUint32(read(4), true) * MS_SEC;
    let price = view.getUint32(read(4), true) * COPPER_SILVER;
    let quantity = view.getUint32(read(4), true);
    // let quantity = 0
    deltas[snapshot] = { snapshot: snapshot, price: price, quantity: quantity };
    // Workaround for when data collection didn't carry over the price when quantity became zero.
    if (
      deltas[snapshot].quantity === 0 &&
      prevDelta &&
      deltas[snapshot].price === 0
    ) {
      deltas[snapshot].price = prevDelta.price;
    }
    if (!prevDelta) {
      prevDelta = deltas[snapshot];
    }
  }
  //   console.log(deltas);
  //   console.log(prevDelta);

  if (prevDelta) {
    (await getSnapshotList(result.realm)).forEach((timestamp) => {
      if (deltas[timestamp]) {
        // Something changed at this timestamp, and we have new stats.
        prevDelta = deltas[timestamp];
        result.snapshots.push(deltas[timestamp]);
      } else if (prevDelta.snapshot < timestamp) {
        // There were no changes recorded at this snapshot, assume it's the same as the prev snapshot.
        result.snapshots.push({
          snapshot: timestamp,
          price: prevDelta.price,
          quantity: prevDelta.quantity,
        });
      } else {
        // prevDelta.snapshot > timestamp, which means our first record of this item came after now.
        result.snapshots.push({
          snapshot: timestamp,
          price: 0, // We don't know its price, we haven't seen it yet.
          quantity: 0, // We know we saw a snapshot at this timestamp, but no item, so quantity = 0.
        });
      }
    });
  }
  let prices = [];
  let maxPrice = 0;
  let maxQuantity = 0;
  let firstTimestamp = Date.now();
  let lastTimestamp = 0;
  {
    result.snapshots.forEach((snapshot) => {
      maxPrice = Math.max(maxPrice, snapshot.price);
      maxQuantity = Math.max(maxQuantity, snapshot.quantity);
      firstTimestamp = Math.min(firstTimestamp, snapshot.snapshot);
      lastTimestamp = Math.max(lastTimestamp, snapshot.snapshot);
      if (snapshot.price > 0) {
        prices.push(snapshot.price);
      }
    });
    if (maxPrice === 0) {
      return;
    }

    prices.sort((a, b) => a - b);
    let q1 = prices[Math.floor(prices.length * 0.25)];
    let q3 = prices[Math.floor(prices.length * 0.75)];
    let iqr = q3 - q1;

    maxPrice = Math.min(maxPrice, q3 + iqr * 1.5) * 1.15;
  }

  if (prices.length >= 5) {
    let statistics = getStatistics(prices);
    console.log(statistics);

    // regionElements.median.appendChild(priceElement(statistics.median));
    // regionElements.mean.appendChild(priceElement(statistics.mean));
  }

  //   for (let index = 0; index < result.snapshots.length; index++) {
  //     const element = result.snapshots[index];
  //     console.log(index, "  :  ", element);
  //   }

  return result;
}
item = {};
const f = getItemState(item);
