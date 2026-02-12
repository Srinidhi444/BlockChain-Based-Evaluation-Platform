const ExamIntegrityABI = {
  abi: [
    {
      type: "function",
      name: "commitEvaluationHash",
      inputs: [
        { name: "examId", type: "uint256", internalType: "uint256" },
        { name: "submissionId", type: "bytes32", internalType: "bytes32" },
        { name: "evaluationHash", type: "bytes32", internalType: "bytes32" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      type: "function",
      name: "commitSubmissionHash",
      inputs: [
        { name: "examId", type: "uint256", internalType: "uint256" },
        { name: "submissionId", type: "bytes32", internalType: "bytes32" },
        { name: "fileHash", type: "bytes32", internalType: "bytes32" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      type: "function",
      name: "getSubmission",
      inputs: [
        { name: "examId", type: "uint256", internalType: "uint256" },
        { name: "submissionId", type: "bytes32", internalType: "bytes32" },
      ],
      outputs: [
        { name: "fileHash", type: "bytes32", internalType: "bytes32" },
        { name: "evaluationHash", type: "bytes32", internalType: "bytes32" },
        { name: "submittedAt", type: "uint256", internalType: "uint256" },
        { name: "evaluatedAt", type: "uint256", internalType: "uint256" },
      ],
      stateMutability: "view",
    },
    {
      type: "event",
      name: "EvaluationCommitted",
      inputs: [
        {
          name: "examId",
          type: "uint256",
          indexed: true,
          internalType: "uint256",
        },
        {
          name: "submissionId",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32",
        },
        {
          name: "evaluationHash",
          type: "bytes32",
          indexed: false,
          internalType: "bytes32",
        },
        {
          name: "timestamp",
          type: "uint256",
          indexed: false,
          internalType: "uint256",
        },
      ],
      anonymous: false,
    },
    {
      type: "event",
      name: "SubmissionCommitted",
      inputs: [
        {
          name: "examId",
          type: "uint256",
          indexed: true,
          internalType: "uint256",
        },
        {
          name: "submissionId",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32",
        },
        {
          name: "fileHash",
          type: "bytes32",
          indexed: false,
          internalType: "bytes32",
        },
        {
          name: "timestamp",
          type: "uint256",
          indexed: false,
          internalType: "uint256",
        },
      ],
      anonymous: false,
    },
  ],
  bytecode: {
    object:
      "0x6080604052348015600e575f5ffd5b506106398061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c80631d9912171461004357806367744a4c1461005f5780639c33b50214610092575b5f5ffd5b61005d600480360381019061005891906103a5565b6100ae565b005b610079600480360381019061007491906103f5565b6101bd565b6040516100899493929190610451565b60405180910390f35b6100ac60048036038101906100a791906103a5565b61023a565b005b5f5f5f8581526020019081526020015f205f8481526020019081526020015f206002015414610112576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610109906104ee565b60405180910390fd5b60405180608001604052808281526020015f5f1b81526020014281526020015f8152505f5f8581526020019081526020015f205f8481526020019081526020015f205f820151815f015560208201518160010155604082015181600201556060820151816003015590505081837f985cc95c2f13e6b36c1c1a1f1c9b4bf52020aaf02ce1dc90f68d989624501b8183426040516101b092919061050c565b60405180910390a3505050565b5f5f5f5f5f5f5f8881526020019081526020015f205f8781526020019081526020015f206040518060800160405290815f820154815260200160018201548152602001600282015481526020016003820154815250509050805f015181602001518260400151836060015194509450945094505092959194509250565b5f5f5f8581526020019081526020015f205f8481526020019081526020015f2090505f8160020154036102a2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016102999061057d565b60405180910390fd5b5f8160030154146102e8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016102df906105e5565b60405180910390fd5b81816001018190555042816003018190555082847fc045ace165fc681d944690effb008dd29c48fda0a86b9a17ef264fc3d80f686f844260405161032d92919061050c565b60405180910390a350505050565b5f5ffd5b5f819050919050565b6103518161033f565b811461035b575f5ffd5b50565b5f8135905061036c81610348565b92915050565b5f819050919050565b61038481610372565b811461038e575f5ffd5b50565b5f8135905061039f8161037b565b92915050565b5f5f5f606084860312156103bc576103bb61033b565b5b5f6103c98682870161035e565b93505060206103da86828701610391565b92505060406103eb86828701610391565b9150509250925092565b5f5f6040838503121561040b5761040a61033b565b5b5f6104188582860161035e565b925050602061042985828601610391565b9150509250929050565b61043c81610372565b82525050565b61044b8161033f565b82525050565b5f6080820190506104645f830187610433565b6104716020830186610433565b61047e6040830185610442565b61048b6060830184610442565b95945050505050565b5f82825260208201905092915050565b7f416c7265616479207375626d69747465640000000000000000000000000000005f82015250565b5f6104d8601183610494565b91506104e3826104a4565b602082019050919050565b5f6020820190508181035f830152610505816104cc565b9050919050565b5f60408201905061051f5f830185610433565b61052c6020830184610442565b9392505050565b7f5375626d697373696f6e206e6f7420666f756e640000000000000000000000005f82015250565b5f610567601483610494565b915061057282610533565b602082019050919050565b5f6020820190508181035f8301526105948161055b565b9050919050565b7f416c7265616479206576616c75617465640000000000000000000000000000005f82015250565b5f6105cf601183610494565b91506105da8261059b565b602082019050919050565b5f6020820190508181035f8301526105fc816105c3565b905091905056fea2646970667358221220b2186e2da469e7b70b9805f79c43566866c68861edb59c708d877ddcd1459f3964736f6c63430008210033",
    sourceMap: "58:2357:19:-:0;;;;;;;;;;;;;;;;;;;",
    linkReferences: {},
  },
  deployedBytecode: {
    object:
      "0x608060405234801561000f575f5ffd5b506004361061003f575f3560e01c80631d9912171461004357806367744a4c1461005f5780639c33b50214610092575b5f5ffd5b61005d600480360381019061005891906103a5565b6100ae565b005b610079600480360381019061007491906103f5565b6101bd565b6040516100899493929190610451565b60405180910390f35b6100ac60048036038101906100a791906103a5565b61023a565b005b5f5f5f8581526020019081526020015f205f8481526020019081526020015f206002015414610112576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610109906104ee565b60405180910390fd5b60405180608001604052808281526020015f5f1b81526020014281526020015f8152505f5f8581526020019081526020015f205f8481526020019081526020015f205f820151815f015560208201518160010155604082015181600201556060820151816003015590505081837f985cc95c2f13e6b36c1c1a1f1c9b4bf52020aaf02ce1dc90f68d989624501b8183426040516101b092919061050c565b60405180910390a3505050565b5f5f5f5f5f5f5f8881526020019081526020015f205f8781526020019081526020015f206040518060800160405290815f820154815260200160018201548152602001600282015481526020016003820154815250509050805f015181602001518260400151836060015194509450945094505092959194509250565b5f5f5f8581526020019081526020015f205f8481526020019081526020015f2090505f8160020154036102a2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016102999061057d565b60405180910390fd5b5f8160030154146102e8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016102df906105e5565b60405180910390fd5b81816001018190555042816003018190555082847fc045ace165fc681d944690effb008dd29c48fda0a86b9a17ef264fc3d80f686f844260405161032d92919061050c565b60405180910390a350505050565b5f5ffd5b5f819050919050565b6103518161033f565b811461035b575f5ffd5b50565b5f8135905061036c81610348565b92915050565b5f819050919050565b61038481610372565b811461038e575f5ffd5b50565b5f8135905061039f8161037b565b92915050565b5f5f5f606084860312156103bc576103bb61033b565b5b5f6103c98682870161035e565b93505060206103da86828701610391565b92505060406103eb86828701610391565b9150509250925092565b5f5f6040838503121561040b5761040a61033b565b5b5f6104188582860161035e565b925050602061042985828601610391565b9150509250929050565b61043c81610372565b82525050565b61044b8161033f565b82525050565b5f6080820190506104645f830187610433565b6104716020830186610433565b61047e6040830185610442565b61048b6060830184610442565b95945050505050565b5f82825260208201905092915050565b7f416c7265616479207375626d69747465640000000000000000000000000000005f82015250565b5f6104d8601183610494565b91506104e3826104a4565b602082019050919050565b5f6020820190508181035f830152610505816104cc565b9050919050565b5f60408201905061051f5f830185610433565b61052c6020830184610442565b9392505050565b7f5375626d697373696f6e206e6f7420666f756e640000000000000000000000005f82015250565b5f610567601483610494565b915061057282610533565b602082019050919050565b5f6020820190508181035f8301526105948161055b565b9050919050565b7f416c7265616479206576616c75617465640000000000000000000000000000005f82015250565b5f6105cf601183610494565b91506105da8261059b565b602082019050919050565b5f6020820190508181035f8301526105fc816105c3565b905091905056fea2646970667358221220b2186e2da469e7b70b9805f79c43566866c68861edb59c708d877ddcd1459f3964736f6c63430008210033",
    sourceMap:
      "58:2357:19:-:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;728:575;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;1930:483;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;;;;:::i;:::-;;;;;;;;1339:557;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;728:575;920:1;871:11;:19;883:6;871:19;;;;;;;;;;;:33;891:12;871:33;;;;;;;;;;;:45;;;:50;863:80;;;;;;;;;;;;:::i;:::-;;;;;;;;;990:164;;;;;;;;1025:8;990:164;;;;1071:1;1063:10;;990:164;;;;1100:15;990:164;;;;1142:1;990:164;;;954:11;:19;966:6;954:19;;;;;;;;;;;:33;974:12;954:33;;;;;;;;;;;:200;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1223:12;1203:6;1170:126;1249:8;1271:15;1170:126;;;;;;;:::i;:::-;;;;;;;;728:575;;;:::o;1930:483::-;2073:16;2103:22;2139:19;2172;2216;2238:11;:19;2250:6;2238:19;;;;;;;;;;;:33;2258:12;2238:33;;;;;;;;;;;2216:55;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2302:1;:10;;;2326:1;:16;;;2356:1;:13;;;2383:1;:13;;;2281:125;;;;;;;;;1930:483;;;;;;;:::o;1339:557::-;1480:20;1503:11;:19;1515:6;1503:19;;;;;;;;;;;:33;1523:12;1503:33;;;;;;;;;;;1480:56;;1572:1;1555;:13;;;:18;1547:51;;;;;;;;;;;;:::i;:::-;;;;;;;;;1633:1;1616;:13;;;:18;1608:48;;;;;;;;;;;;:::i;:::-;;;;;;;;;1686:14;1667:1;:16;;:33;;;;1726:15;1710:1;:13;;:31;;;;1810:12;1790:6;1757:132;1836:14;1864:15;1757:132;;;;;;;:::i;:::-;;;;;;;;1470:426;1339:557;;;:::o;88:117:21:-;197:1;194;187:12;334:77;371:7;400:5;389:16;;334:77;;;:::o;417:122::-;490:24;508:5;490:24;:::i;:::-;483:5;480:35;470:63;;529:1;526;519:12;470:63;417:122;:::o;545:139::-;591:5;629:6;616:20;607:29;;645:33;672:5;645:33;:::i;:::-;545:139;;;;:::o;690:77::-;727:7;756:5;745:16;;690:77;;;:::o;773:122::-;846:24;864:5;846:24;:::i;:::-;839:5;836:35;826:63;;885:1;882;875:12;826:63;773:122;:::o;901:139::-;947:5;985:6;972:20;963:29;;1001:33;1028:5;1001:33;:::i;:::-;901:139;;;;:::o;1046:619::-;1123:6;1131;1139;1188:2;1176:9;1167:7;1163:23;1159:32;1156:119;;;1194:79;;:::i;:::-;1156:119;1314:1;1339:53;1384:7;1375:6;1364:9;1360:22;1339:53;:::i;:::-;1329:63;;1285:117;1441:2;1467:53;1512:7;1503:6;1492:9;1488:22;1467:53;:::i;:::-;1457:63;;1412:118;1569:2;1595:53;1640:7;1631:6;1620:9;1616:22;1595:53;:::i;:::-;1585:63;;1540:118;1046:619;;;;;:::o;1671:474::-;1739:6;1747;1796:2;1784:9;1775:7;1771:23;1767:32;1764:119;;;1802:79;;:::i;:::-;1764:119;1922:1;1947:53;1992:7;1983:6;1972:9;1968:22;1947:53;:::i;:::-;1937:63;;1893:117;2049:2;2075:53;2120:7;2111:6;2100:9;2096:22;2075:53;:::i;:::-;2065:63;;2020:118;1671:474;;;;;:::o;2151:118::-;2238:24;2256:5;2238:24;:::i;:::-;2233:3;2226:37;2151:118;;:::o;2275:::-;2362:24;2380:5;2362:24;:::i;:::-;2357:3;2350:37;2275:118;;:::o;2399:553::-;2576:4;2614:3;2603:9;2599:19;2591:27;;2628:71;2696:1;2685:9;2681:17;2672:6;2628:71;:::i;:::-;2709:72;2777:2;2766:9;2762:18;2753:6;2709:72;:::i;:::-;2791;2859:2;2848:9;2844:18;2835:6;2791:72;:::i;:::-;2873;2941:2;2930:9;2926:18;2917:6;2873:72;:::i;:::-;2399:553;;;;;;;:::o;2958:169::-;3042:11;3076:6;3071:3;3064:19;3116:4;3111:3;3107:14;3092:29;;2958:169;;;;:::o;3133:167::-;3273:19;3269:1;3261:6;3257:14;3250:43;3133:167;:::o;3306:366::-;3448:3;3469:67;3533:2;3528:3;3469:67;:::i;:::-;3462:74;;3545:93;3634:3;3545:93;:::i;:::-;3663:2;3658:3;3654:12;3647:19;;3306:366;;;:::o;3678:419::-;3844:4;3882:2;3871:9;3867:18;3859:26;;3931:9;3925:4;3921:20;3917:1;3906:9;3902:17;3895:47;3959:131;4085:4;3959:131;:::i;:::-;3951:139;;3678:419;;;:::o;4103:332::-;4224:4;4262:2;4251:9;4247:18;4239:26;;4275:71;4343:1;4332:9;4328:17;4319:6;4275:71;:::i;:::-;4356:72;4424:2;4413:9;4409:18;4400:6;4356:72;:::i;:::-;4103:332;;;;;:::o;4441:170::-;4581:22;4577:1;4569:6;4565:14;4558:46;4441:170;:::o;4617:366::-;4759:3;4780:67;4844:2;4839:3;4780:67;:::i;:::-;4773:74;;4856:93;4945:3;4856:93;:::i;:::-;4974:2;4969:3;4965:12;4958:19;;4617:366;;;:::o;4989:419::-;5155:4;5193:2;5182:9;5178:18;5170:26;;5242:9;5236:4;5232:20;5228:1;5217:9;5213:17;5206:47;5270:131;5396:4;5270:131;:::i;:::-;5262:139;;4989:419;;;:::o;5414:167::-;5554:19;5550:1;5542:6;5538:14;5531:43;5414:167;:::o;5587:366::-;5729:3;5750:67;5814:2;5809:3;5750:67;:::i;:::-;5743:74;;5826:93;5915:3;5826:93;:::i;:::-;5944:2;5939:3;5935:12;5928:19;;5587:366;;;:::o;5959:419::-;6125:4;6163:2;6152:9;6148:18;6140:26;;6212:9;6206:4;6202:20;6198:1;6187:9;6183:17;6176:47;6240:131;6366:4;6240:131;:::i;:::-;6232:139;;5959:419;;;:::o",
    linkReferences: {},
  },
  methodIdentifiers: {
    "commitEvaluationHash(uint256,bytes32,bytes32)": "9c33b502",
    "commitSubmissionHash(uint256,bytes32,bytes32)": "1d991217",
    "getSubmission(uint256,bytes32)": "67744a4c",
  },
  rawMetadata:
    '{"compiler":{"version":"0.8.33+commit.64118f21"},"language":"Solidity","output":{"abi":[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"examId","type":"uint256"},{"indexed":true,"internalType":"bytes32","name":"submissionId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"evaluationHash","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"EvaluationCommitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"examId","type":"uint256"},{"indexed":true,"internalType":"bytes32","name":"submissionId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"fileHash","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"SubmissionCommitted","type":"event"},{"inputs":[{"internalType":"uint256","name":"examId","type":"uint256"},{"internalType":"bytes32","name":"submissionId","type":"bytes32"},{"internalType":"bytes32","name":"evaluationHash","type":"bytes32"}],"name":"commitEvaluationHash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"examId","type":"uint256"},{"internalType":"bytes32","name":"submissionId","type":"bytes32"},{"internalType":"bytes32","name":"fileHash","type":"bytes32"}],"name":"commitSubmissionHash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"examId","type":"uint256"},{"internalType":"bytes32","name":"submissionId","type":"bytes32"}],"name":"getSubmission","outputs":[{"internalType":"bytes32","name":"fileHash","type":"bytes32"},{"internalType":"bytes32","name":"evaluationHash","type":"bytes32"},{"internalType":"uint256","name":"submittedAt","type":"uint256"},{"internalType":"uint256","name":"evaluatedAt","type":"uint256"}],"stateMutability":"view","type":"function"}],"devdoc":{"kind":"dev","methods":{},"version":1},"userdoc":{"kind":"user","methods":{},"version":1}},"settings":{"compilationTarget":{"src/ExamIntegrity.sol":"ExamIntegrity"},"evmVersion":"prague","libraries":{},"metadata":{"bytecodeHash":"ipfs"},"optimizer":{"enabled":false,"runs":200},"remappings":[":forge-std/=lib/forge-std/src/"]},"sources":{"src/ExamIntegrity.sol":{"keccak256":"0x883c9b3b65c4659cebc64f717cc35decb67d2300e40eb82754c4ddd97cbcf215","license":"MIT","urls":["bzz-raw://49fad47bd92ad5c8b34648f0fd3c8c365e697cc54f1b8df5dfb20471664b13d2","dweb:/ipfs/QmT3vmPyjp4HKNb6B6tVEwU93DXQa4G5ZzniWE7nQGQND1"]}},"version":1}',
  metadata: {
    compiler: { version: "0.8.33+commit.64118f21" },
    language: "Solidity",
    output: {
      abi: [
        {
          inputs: [
            {
              internalType: "uint256",
              name: "examId",
              type: "uint256",
              indexed: true,
            },
            {
              internalType: "bytes32",
              name: "submissionId",
              type: "bytes32",
              indexed: true,
            },
            {
              internalType: "bytes32",
              name: "evaluationHash",
              type: "bytes32",
              indexed: false,
            },
            {
              internalType: "uint256",
              name: "timestamp",
              type: "uint256",
              indexed: false,
            },
          ],
          type: "event",
          name: "EvaluationCommitted",
          anonymous: false,
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "examId",
              type: "uint256",
              indexed: true,
            },
            {
              internalType: "bytes32",
              name: "submissionId",
              type: "bytes32",
              indexed: true,
            },
            {
              internalType: "bytes32",
              name: "fileHash",
              type: "bytes32",
              indexed: false,
            },
            {
              internalType: "uint256",
              name: "timestamp",
              type: "uint256",
              indexed: false,
            },
          ],
          type: "event",
          name: "SubmissionCommitted",
          anonymous: false,
        },
        {
          inputs: [
            { internalType: "uint256", name: "examId", type: "uint256" },
            { internalType: "bytes32", name: "submissionId", type: "bytes32" },
            {
              internalType: "bytes32",
              name: "evaluationHash",
              type: "bytes32",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
          name: "commitEvaluationHash",
        },
        {
          inputs: [
            { internalType: "uint256", name: "examId", type: "uint256" },
            { internalType: "bytes32", name: "submissionId", type: "bytes32" },
            { internalType: "bytes32", name: "fileHash", type: "bytes32" },
          ],
          stateMutability: "nonpayable",
          type: "function",
          name: "commitSubmissionHash",
        },
        {
          inputs: [
            { internalType: "uint256", name: "examId", type: "uint256" },
            { internalType: "bytes32", name: "submissionId", type: "bytes32" },
          ],
          stateMutability: "view",
          type: "function",
          name: "getSubmission",
          outputs: [
            { internalType: "bytes32", name: "fileHash", type: "bytes32" },
            {
              internalType: "bytes32",
              name: "evaluationHash",
              type: "bytes32",
            },
            { internalType: "uint256", name: "submittedAt", type: "uint256" },
            { internalType: "uint256", name: "evaluatedAt", type: "uint256" },
          ],
        },
      ],
      devdoc: { kind: "dev", methods: {}, version: 1 },
      userdoc: { kind: "user", methods: {}, version: 1 },
    },
    settings: {
      remappings: ["forge-std/=lib/forge-std/src/"],
      optimizer: { enabled: false, runs: 200 },
      metadata: { bytecodeHash: "ipfs" },
      compilationTarget: { "src/ExamIntegrity.sol": "ExamIntegrity" },
      evmVersion: "prague",
      libraries: {},
    },
    sources: {
      "src/ExamIntegrity.sol": {
        keccak256:
          "0x883c9b3b65c4659cebc64f717cc35decb67d2300e40eb82754c4ddd97cbcf215",
        urls: [
          "bzz-raw://49fad47bd92ad5c8b34648f0fd3c8c365e697cc54f1b8df5dfb20471664b13d2",
          "dweb:/ipfs/QmT3vmPyjp4HKNb6B6tVEwU93DXQa4G5ZzniWE7nQGQND1",
        ],
        license: "MIT",
      },
    },
    version: 1,
  },
  id: 19,
};
export default ExamIntegrityABI;
