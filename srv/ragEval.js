const llm = require("./llm");
const prompts = require("./prompts.json");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");


class RAGEvalService extends cds.ApplicationService {
    init() {
        this.on("test", async (req)=>{
            const res = await llm.embeddingAPI("say hello to every user", "text-embedding-ada-002")
            console.log(res)
        })
        
        this.on("runTestForConfig", async (req)=>{
            console.log("running Test for configuration:"+req.data.configID);
            const testRunID = cds.utils.uuid();
            //retrieve config data
            let configData = await cds.run(
                `
                SELECT * 
                FROM RAGEVAL_Configuration
                WHERE ID = '${req.data.configID}'
                `
            )
            
            let config = configData[0];

            //retrieve relevant Source Doc from DB
            let sourceDocData = await cds.run(
                `
                SELECT content 
                FROM RAGEVAL_SOURCEDOCUMENTS
                WHERE ID = '${req.data.sourceDocID}'
                `
            )

            let docText = sourceDocData[0].CONTENT;

            //chunk recording to config
            let splitter = new RecursiveCharacterTextSplitter({
                chunkSize: config.CHUNKSIZE,
                chunkOverlap: config.CHUNKOVERLAP,
            });
            
            let textChunks = await splitter.splitText(docText);
            for (let chunk of textChunks){
                chunk = chunk.replace(/'/g, ' ');
                //create vector embeddings according to config
                const embedding = await llm.embeddingAPI(chunk,config.EMBEDDINGMODEL);
                //insert chunks into DB
                await cds.run(`
                    INSERT INTO RAGEVAL_CHUNKS
                    VALUES('${cds.utils.uuid()}','${testRunID}','${req.data.sourceDocID}','${chunk}',to_real_vector('${embedding}'))
                `);
            }

            //retrieve tasks from DB for Source Doc
            let tasks = await cds.run(
                `
                SELECT *
                FROM RAGEVAL_TASKS
                WHERE SOURCEDOC = '${req.data.sourceDocID}'
                `
            )

            //Start of RAG-Steps 
            const hyperparameters = {
                temperature: config.TEMPERATURE
            }
            //retrieve chunks recording to question and config
            for (let task of tasks){
                const invector = await llm.embeddingAPI(task.QUESTION,config.EMBEDDINGMODEL);
                let retrievedChunks = await cds.run(`
                    SELECT DISTINCT content, cosine_similarity(embedding, to_real_vector('${invector}')) as similarity
                    FROM RAGEVAL_CHUNKS
                    WHERE testRunID = '${testRunID}'
                    ORDER BY similarity DESC
                    limit ${config.CHUNKAMOUNT}
                `)
                //build messages for LLM API
                for (let message of retrievedChunks){
                    delete message.SIMILARITY;
                    message.role = "user";
                    message.name = "knowledge";
                    message.content = message.CONTENT;
                    delete message.CONTENT;
                    if (message.content != undefined) {
                        message.content = message.content.toString().replace(/\n/g, '');
                    }
                }
                //answer question recording to config
                let LLMAnswerData = await llm.invokeLLM(config.RAGPROMPT, retrievedChunks, hyperparameters);
                const sLLLMAnswer = LLMAnswerData.data.answer;

                //for every task let LLM judge if answer is correct
                let judgeAnswer = await llm.invokeLLM(prompts.judge,sLLLMAnswer,)

            }


            //insert into results(count correct)

        })

        this.on("taskGeneration", async (req)=>{
            console.log("creating tasks for"+req.data.SourceID);
            let tasksString = await llm.taskCreator(req.data.SourceID);
            tasksString = tasksString.data.answer;
            let tasksArray;
            try {
                console.log(tasksString.split("```json ")[1])
                tasksArray = JSON.parse(tasksString.split("```")[1].split("json")[1]);
            }
            catch {
                console.log("clean json?")
                tasksArray = JSON.parse(tasksString)
            }
            for (let task of tasksArray){
                await cds.run(`
                    INSERT INTO RAGEVAL_TASKS
                    VALUES('${cds.utils.uuid()}','${req.data.SourceID}','${task.question.replace(/'/g, ' ')}','${task.answer.replace(/'/g, ' ')}')
                    `)
            }
        })

        return super.init();
    }
}

module.exports = { RAGEvalService };