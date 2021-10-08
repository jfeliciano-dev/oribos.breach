import fetch from "node-fetch"

async function fetchSnapshotList() {
    // if (
    //     my.lastSnapshotList.data &&
    //     my.lastSnapshotList.checked > Date.now() - REALM_STATE_CACHE_DURATION
    // ) {
    //     return my.lastSnapshotList.data;
    // }

    const response = await fetch('https://oribos.exchange/data/global/state.bin', { mode: 'same-origin' });
    if (!response.ok) {
        throw "Unable to get global state";
    }

    // if (my.lastSnapshotList.data &&
    //     my.lastSnapshotList.modified === response.headers.get('last-modified')
    // ) {
    //     my.lastSnapshotList.checked = Date.now();

    //     return my.lastSnapshotList.data;
    // }
    const MS_SEC = 1000;
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    let offset = 0;
    const read = function (byteCount) {
        let result = offset;
        offset += byteCount;

        return result;
    };

    let version = view.getUint8(read(1));
    console.log(version)
    // switch (version) {
    //     case VERSION_GLOBAL_STATE:
    //         // no op
    //         break;
    //     default:
    //         throw "Unknown data version for global state.";
    // }

    /** @type {Object.<ConnectedRealmID, Timestamp[]>} result */
    const result = {};

    // Skip the first timestamp list.
    const firstListLength = view.getUint16(read(2), true);
    offset += firstListLength * (2 + 4);

    // Load the snapshot lists.
    for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
        let realmId = view.getUint16(read(2), true);
        result[realmId] = [];
        for (let realmRemaining = view.getUint16(read(2), true); realmRemaining > 0; realmRemaining--) {
            result[realmId].push(view.getUint32(read(4), true) * MS_SEC);
        }
        Object.freeze(result[realmId]);
    }
    Object.freeze(result);

    let lastSnapshotList = {
        modified: response.headers.get('last-modified'),
        checked: Date.now(),
        data: result,
    };

    // console.log(lastSnapshotList)
    console.log(result['3676'])

    return result;
}
fetchSnapshotList();