import { describe, expect, it } from "vitest";

import { type CsvMapping, findDuplicateCandidates, parseCsv, parseQif } from "../index";

const mapping: CsvMapping = {
  delimiter: ",",
  hasHeader: true,
  skipRows: 0,
  dateColumn: 0,
  dateFormat: "us",
  payeeColumn: 1,
  memoColumn: 2,
  amountColumn: 3,
  inflowColumn: null,
  outflowColumn: null,
  categoryColumn: 4,
  negate: false,
};

describe("parseCsv", () => {
  it("should read quotes, dates, amounts, and categories", () => {
    const text = `Date,Payee,Memo,Amount,Category
01/05/2026,"Shop, Inc",Lunch,"-12.34",Food
01/06/2026,Employer,Salary,"2,000.00",`;
    const result = parseCsv(text, mapping, "USD", 2);
    if (result.isErr()) throw result.error;
    expect(result.value.errors).toHaveLength(0);
    expect(result.value.rows).toHaveLength(2);
    expect(result.value.rows[0]).toMatchObject({
      date: "2026-01-05",
      amountMinor: -1234,
      payeeName: "Shop, Inc",
      categoryName: "Food",
    });
    expect(result.value.rows[1]?.amountMinor).toBe(200_000);
    expect(result.value.rows[1]?.categoryName).toBeNull();
  });

  it("should read separate inflow and outflow columns", () => {
    const text = `Date,Payee,In,Out
2026-01-05,Employer,2000.00,
2026-01-06,Shop,,12.34`;
    const result = parseCsv(
      text,
      {
        ...mapping,
        dateFormat: "iso",
        memoColumn: null,
        amountColumn: null,
        inflowColumn: 2,
        outflowColumn: 3,
        categoryColumn: null,
      },
      "USD",
      2,
    );
    if (result.isErr()) throw result.error;
    expect(result.value.rows[0]?.amountMinor).toBe(200_000);
    expect(result.value.rows[1]?.amountMinor).toBe(-1234);
  });

  it("should report a bad row without dropping the good ones", () => {
    const text = `Date,Payee,Memo,Amount,Category
01/05/2026,Shop,,nope,Food
01/06/2026,Market,,"-5.00",Food`;
    const result = parseCsv(text, mapping, "USD", 2);
    if (result.isErr()) throw result.error;
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.rows).toHaveLength(1);
  });
});

describe("parseQif", () => {
  it("should read records, splits, and transfers", () => {
    const text = `!Type:Bank
D1/05/2026
T-12.34
PShop
MLunch
LFood
C*
^
D1/06/2026
T-100.00
PMarket
LFood:Groceries
SFood:Groceries
EProduce
$-60.00
SHousehold
E
$-40.00
^
D1/07/2026
T-500.00
PTransfer
L[Savings]
^
`;
    const result = parseQif(text, "USD", 2, { dateFormat: "us" });
    if (result.isErr()) throw result.error;
    expect(result.value.rows).toHaveLength(3);
    expect(result.value.rows[0]).toMatchObject({
      date: "2026-01-05",
      amountMinor: -1234,
      categoryName: "Food",
      cleared: "cleared",
    });
    expect(result.value.rows[1]?.splits).toHaveLength(2);
    expect(result.value.rows[1]?.splits[0]?.amountMinor).toBe(-6000);
    expect(result.value.rows[2]).toMatchObject({
      categoryName: null,
      transferAccountName: "Savings",
    });
  });
});

describe("dedupe", () => {
  it("should propose a near match with the same amount", () => {
    const existing = [
      {
        id: "txn_1",
        accountId: "acct_1",
        date: "2026-01-05",
        payeeName: "Shop Inc",
        amountMinor: -1234,
        parentId: null,
      },
    ];
    const candidates = findDuplicateCandidates(
      existing as never,
      {
        date: "2026-01-06",
        amountMinor: -1234,
        payeeName: "SHOP, INC.",
        memo: "",
        categoryName: null,
        cleared: "uncleared",
        externalId: null,
        transferAccountName: null,
        splits: [],
      },
      "acct_1",
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.transactionId).toBe("txn_1");
  });

  it("should ignore a different amount", () => {
    const existing = [
      {
        id: "txn_1",
        accountId: "acct_1",
        date: "2026-01-05",
        payeeName: "Shop Inc",
        amountMinor: -1200,
        parentId: null,
      },
    ];
    const candidates = findDuplicateCandidates(
      existing as never,
      {
        date: "2026-01-05",
        amountMinor: -1234,
        payeeName: "Shop Inc",
        memo: "",
        categoryName: null,
        cleared: "uncleared",
        externalId: null,
        transferAccountName: null,
        splits: [],
      },
      "acct_1",
    );
    expect(candidates).toHaveLength(0);
  });
});
