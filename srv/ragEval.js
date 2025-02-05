const llm = require("./llm");

class RAGEvalService extends cds.ApplicationService {
    init() {
        this.on("test", async (req)=>{
            const res = await llm.embeddingAPI("say hello to every user", "text-embedding-ada-002")
            console.log(res)
        })
        
        this.on("runTestForConfig", async (req)=>{
            console.log("running Test for configuration:"+req.data.configID)
        })

        this.on("taskGeneration", async (req)=>{
            console.log("creating tasks for"+req.data.SourceID);
            return await llm.taskCreator(req.data.SourceID);
        })

        return super.init();
    }
}

module.exports = { RAGEvalService };