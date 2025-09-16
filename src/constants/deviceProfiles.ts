import type { Language } from "@point-of-sale/receipt-printer-encoder";

const DEVICE_PROFILES: Array<{
  filters: [{ vendorId: number; productId?: number }];
  configuration: number;
  interface: number;
  language: Language;
  codepageMapping: string;
}> = [
  /* POS-8022 and similar printers */
  {
    filters: [{ vendorId: 0x0483, productId: 0x5743 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "default",
  },

  /* POS-5805, POS-8360 and similar printers */
  {
    filters: [{ vendorId: 0x0416, productId: 0x5011 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "zjiang",
  },

  /* MPT-II and similar printers */
  {
    filters: [{ vendorId: 0x0483, productId: 0x5840 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "mpt",
  },

  /* Samsung SRP */
  {
    filters: [{ vendorId: 0x1504 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "bixolon",
  },

  /* Samsung SRP */
  {
    filters: [{ vendorId: 0x0419 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "bixolon",
  },

  /* Star */
  // {
  //   filters: [{ vendorId: 0x0519 }],

  //   configuration: 1,
  //   interface: 0,

  //   /*

  // 		vendorId	productId	productName

  // 								FVP10				star-line
  // 		0x0519		0x0001		TSP650II			star-line
  // 								TSP700II			star-line
  // 								TSP800II			star-line
  // 								SP700				star-line
  // 		0x0519 		0x0003		TSP100II			star-graphics
  // 								TSP100III			star-graphics
  // 								TSP100IV			star-prnt
  // 		0x0519		0x0017		mPOP				star-prnt
  // 		0x0519		0x0019		mC-Label3			star-prnt
  // 		0x0519		0x000b		BSC10				esc-pos
  // 		0x0519		0x0011		BSC10BR				esc-pos
  // 		0x0519		0x001b		BSC10II				esc-pos
  // 		0x0519		0x0043		SM-S230i
  // 		0x0519		0x0047		mC-Print3			star-prnt
  // 		0x0519		0x0049		mC-Print2			star-prnt

  // 	*/

  //   language: (device) => {
  //     let language = "star-line";
  //     let name = device.productName;

  //     /*
  // 								Even though the product names are a bit messy, the best way to distinguish between
  // 								models is by the product name. It is not possible to do it by the productId alone,
  // 								as the same productId is used for different models supporting different languages.

  // 								But we do need to normalize the names a bit, as they are not consistent.

  // 								For example:
  // 								TSP654 (STR_T-001) -> TSP650
  // 								Star TSP143IIIU -> TSP100III
  // 							*/

  //     name = name.replace(/^Star\s+/i, "");
  //     name = name.replace(
  //       /^TSP(1|4|6|7|8|10)(13|43)(.*)?$/,
  //       (m: string, p1: string, p2: string, p3: string) =>
  //         "TSP" + p1 + "00" + (p3 || "")
  //     );
  //     name = name.replace(
  //       /^TSP(55|65)(1|4)(.*)?$/,
  //       (m: string, p1: string, p2: string, p3: string) =>
  //         "TSP" + p1 + "0" + (p3 || "")
  //     );
  //     name = name.replace(
  //       /^TSP([0-9]+)(II|III|IV|V|VI)?(.*)?$/,
  //       (m: string, p1: string, p2: string) => "TSP" + p1 + (p2 || "")
  //     );

  //     switch (name) {
  //       case "TSP100IV":
  //       case "mPOP":
  //       case "mC-Label3":
  //       case "mC-Print3":
  //       case "mC-Print2":
  //         language = "star-prnt";
  //         break;

  //       case "TSP100":
  //       case "TSP100II":
  //       case "TSP100III":
  //         language = "star-graphics";
  //         break;

  //       case "BSC10":
  //       case "BSC10BR":
  //       case "BSC10II":
  //         language = "esc-pos";
  //         break;
  //     }

  //     return language;
  //   },

  //   codepageMapping: "star",
  // },

  /* Epson */
  {
    filters: [{ vendorId: 0x04b8 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "epson",
  },

  /* Citizen */
  {
    filters: [{ vendorId: 0x1d90 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "citizen",
  },

  /* HP */
  {
    filters: [{ vendorId: 0x05d9 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "hp",
  },

  /* Fujitsu */

  {
    filters: [{ vendorId: 0x04c5 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "epson",
  },

  /* Dtronic */
  {
    filters: [{ vendorId: 0x0fe6, productId: 0x811e }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "epson",
  },

  /* Xprinter */
  {
    filters: [{ vendorId: 0x1fc9, productId: 0x2016 }],

    configuration: 1,
    interface: 0,

    language: "esc-pos",
    codepageMapping: "xprinter",
  },
];

export { DEVICE_PROFILES };
