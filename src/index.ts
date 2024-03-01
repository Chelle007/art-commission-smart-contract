import { Canister, update, query, Vec, Opt, Ok, Result, Record, Variant, Principal, Err, text, bool, nat64, StableBTreeMap, int8 } from 'azle';

// Define types for User, Status, Commission, Transaction, and Error

const User = Record({
    userID: Principal,
    username: text
});
type User = typeof User.tsType;

const Status = Record({
    Pending: bool,
    Accepted: bool,
    Rejected: bool,
    ArtworkSubmitted: bool,
    Approved: bool,
    Cancelled: bool
})
type Status = typeof Status.tsType;

const Commission = Record({
    commissionID: Principal,
    artistID: Principal,
    price: nat64,
    max_revision: int8,
    availability: bool
})
type Commission = typeof Commission.tsType;

const Transaction = Record({
    transactionID: Principal,
    commissionID: Principal,
    customerID: Principal,
    remaining_revision: int8,
    status: Status
});
type Transaction = typeof Transaction.tsType;

const Error = Variant({
    NotFound: text,
    NoRemainingRevision: text,
    InvalidTransaction: text
})
type Error = typeof Error.tsType;

// Map to store artists, customers, commission types, and transactions
let users = StableBTreeMap<Principal, User>(0);
let commissions = StableBTreeMap<Principal, Commission>(1);
let transactions = StableBTreeMap<Principal, Transaction>(2);

export default Canister({
    createUser: update([text], User, (username) => {
        const userID = generateId();
        const user: User = {
            userID,
            username
        };

        users.insert(user.userID, user);

        return user;
    }),

    readUsers: query([], Vec(User), () => {
        return users.values();
    }),

    readUserById: query([Principal], Opt(User), (id) => {
        return users.get(id);
    }),

    readCommissions: query([], Vec(Transaction), () => {
        return transactions.values();
    }),

    readCommissionById: query([Principal], Opt(Transaction), (id) => {
        return transactions.get(id);
    }),

    // FOR CLIENT
    // Method for client to set a new commission for specific artist
    setCommission: update([Principal, Principal], Result(Transaction, Error), (commissionID, customerID) => {
        const commissionOpt = commissions.get(commissionID);
        if ("None" in commissionOpt) {
            return Err({ NotFound: `cannot create the commission: artist=${commissionID} not found` });
        }
        const commission = commissionOpt.Some;

        const userOpt = users.get(customerID);
        if ("None" in userOpt) {
            return Err({ NotFound: `cannot create the commission: customer=${customerID} not found` });
        }

        const transactionID = generateId();
        const transaction: Transaction = {
            transactionID,
            commissionID,
            customerID,
            remaining_revision: commission.max_revision,
            status: { 
                Pending: true,
                Accepted: false,
                Rejected: false,
                ArtworkSubmitted: false,
                Approved: false,
                Cancelled: false
            }
        }

        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

    // Method for client to end the commission by approving the artwork
    approveCommission: update([Principal], Result(Transaction, Error), (transactionID) => {
        const transactionOpt = transactions.get(transactionID);
        if ("None" in transactionOpt) {
            return Err({ NotFound: `cannot approve commission: transaction=${transactionID} not found` });
        }
        const transaction = transactionOpt.Some;

        const transactionValidity = checkCommissionValidity(transaction.status, "approve commission");
        if (transactionValidity!=="valid") {
            return Err({ InvalidTransaction: transactionValidity});
        }
        
        transaction.status.Approved = true;
        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

    // Method for client to request revision
    requestRevision: update([Principal], Result(Transaction, Error), (transactionID) => {
        const transactionOpt = transactions.get(transactionID);
        if ("None" in transactionOpt) {
            return Err({ NotFound: `cannot request revision: transaction=${transactionID} not found` });
        }
        const transaction = transactionOpt.Some;

        const transactionValidity = checkCommissionValidity(transaction.status, "request revision");
        if (transactionValidity!=="valid") {
            return Err({ InvalidTransaction: transactionValidity});
        }
        
        if (transaction.remaining_revision === 0) {
            return Err({ NoRemainingRevision: "no more revision can be made" });
        }
        
        transaction.remaining_revision--;
        transaction.status.ArtworkSubmitted = false;
        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

    // FOR ARTIST
    // Method for artist to create commission type
    createCommissionType: update([Principal, nat64, int8], Result(Commission, Error), (artistID, price, max_revision) => {
        const userOpt = users.get(artistID);
        if ("None" in userOpt) {
            return Err({ NotFound: `cannot create the commission: artist=${artistID} not found` });
        }

        const commissionID = generateId();
        const commission: Commission = {
            commissionID,
            artistID,
            price,
            max_revision,
            availability: true,
        }

        commissions.insert(commissionID, commission);
        return Ok(commission);
    }),

    // Method for artist to accept the commission
    acceptCommission: update([Principal], Result(Transaction, Error), (transactionID) => {
        const transactionOpt = transactions.get(transactionID);
        if ("None" in transactionOpt) {
            return Err({ NotFound: `cannot accept commission: transaction=${transactionID} not found` });
        }
        const transaction = transactionOpt.Some;

        const transactionValidity = checkCommissionValidity(transaction.status, "accept commission");
        if (transactionValidity!=="valid") {
            return Err({ InvalidTransaction: transactionValidity});
        }
        
        transaction.status.Accepted = true;
        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

    // Method for artist to reject the commission
    rejectCommission: update([Principal], Result(Transaction, Error), (transactionID) => {
        const transactionOpt = transactions.get(transactionID);
        if ("None" in transactionOpt) {
            return Err({ NotFound: `cannot reject commission: transaction=${transactionID} not found` });
        }
        const transaction = transactionOpt.Some;

        const transactionValidity = checkCommissionValidity(transaction.status, "reject commission");
        if (transactionValidity!=="valid") {
            return Err({ InvalidTransaction: transactionValidity});
        }
        
        transaction.status.Rejected = true;
        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

    // Method for artist to submit the artwork
    submitArtwork: update([Principal, text], Result(Transaction, Error), (transactionID, artURL) => {
        const transactionOpt = transactions.get(transactionID);
        if ("None" in transactionOpt) {
            return Err({ NotFound: `cannot submit artwork: transaction=${transactionID} not found` });
        }
        const transaction = transactionOpt.Some;

        const transactionValidity = checkCommissionValidity(transaction.status, "submit artwork");
        if (transactionValidity!=="valid") {
            return Err({ InvalidTransaction: transactionValidity});
        }
        
        transaction.status.ArtworkSubmitted = true;
        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

    // FOR BOTH PARTIES
    // Method for both parties to cancel the commission
    cancelCommission: update([Principal], Result(Transaction, Error), (transactionID) => {
        const transactionOpt = transactions.get(transactionID);
        if ("None" in transactionOpt) {
            return Err({ NotFound: `cannot cancel commission: transaction=${transactionID} not found` });
        }
        const transaction = transactionOpt.Some;

        const transactionValidity = checkCommissionValidity(transaction.status, "cancel commission");
        if (transactionValidity!=="valid") {
            return Err({ InvalidTransaction: transactionValidity});
        }
        
        transaction.status.Cancelled = true;
        transactions.insert(transactionID, transaction);
        return Ok(transaction);
    }),

})

// Method to randomly generate ID in Principal type
function generateId(): Principal {
    const randomBytes = new Array(29)
        .fill(0)
        .map((_) => Math.floor(Math.random() * 256));

    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}

// Method to check transaction's validity
function checkCommissionValidity(status: Status, methodType: string): string {
    let transactionValidity = "valid";
    if (status.Cancelled) transactionValidity = "commission has been cancelled";
    else if (status.Approved) transactionValidity = "commission has ended";
    else if (status.Rejected) transactionValidity = "commission has been rejected";
    else if (!status.Accepted && (methodType !== "accept commission" && methodType !== "reject commission")) transactionValidity = "commission has yet to be accepted";
    else if (status.Accepted && (methodType === "accept commission" || methodType === "reject commission")) transactionValidity = "commission has been accepted";
    else if (!status.ArtworkSubmitted && (methodType === "approve commission" || methodType === "request revision")) transactionValidity = "artwork not finished";

    if (transactionValidity!= "valid") return `cannot ${methodType}: ${transactionValidity}`;
    else return "valid";
}