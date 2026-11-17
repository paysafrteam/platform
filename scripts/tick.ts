import { runTick } from "@/server/services/jobs";
import { closePool } from "@/server/db";

runTick().then((s) => { console.log("tick", JSON.stringify(s)); return closePool(); }).catch((e) => { console.error(e.message); process.exit(1); });
