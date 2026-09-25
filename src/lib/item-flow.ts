// Which scan actions a given lens may take at a given item status.
// The server RPC is the real authority; this only decides which buttons to show.

export type Perspective = "consignor" | "consignee" | "admin";

export function availableActions(perspective: Perspective, status: string): string[] {
  if (perspective === "consignor") {
    return status === "labeled" ? ["dispatch"] : [];
  }
  if (perspective === "consignee") {
    switch (status) {
      case "dispatched":
      case "in_transit":
      case "delivered":
        return ["receive"];
      case "received_confirmed":
        return ["list", "return", "flag_damaged"];
      case "listed":
        return ["sell", "return", "flag_damaged"];
      default:
        return [];
    }
  }
  // admin — mirror the happy path
  switch (status) {
    case "labeled":
      return ["dispatch"];
    case "dispatched":
    case "in_transit":
    case "delivered":
      return ["receive"];
    case "received_confirmed":
      return ["list", "return"];
    case "listed":
      return ["sell", "return"];
    default:
      return [];
  }
}

/** Scan actions available on the dedicated scan screen, by lens. */
export function scanActions(perspective: Perspective): string[] {
  if (perspective === "consignor") return ["dispatch", "flag_damaged", "flag_lost"];
  if (perspective === "consignee") return ["receive", "list", "sell", "return", "flag_damaged"];
  return ["dispatch", "receive", "list", "sell", "return"];
}
