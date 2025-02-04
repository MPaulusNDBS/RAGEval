const llm = require("./llm");

class RAGEvalService extends cds.ApplicationService {
    init() {
        this.on("test", async (req)=>{
            const res = await llm.embeddingAPI("say hello to every user", "text-embedding-ada-002")
            console.log(res)
        })

        return super.init();
    }
}

module.exports = { RAGEvalService };