const e = require("express");
const llm = require("./llm");
const prompts = require("./prompts.json");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { cdl } = require("@sap/cds/lib/compile/parse");


class RAGEvalService extends cds.ApplicationService {
    init() {
        this.on("test", async (req)=>{
            await cds.run(`DELETE FROM RAGEVAL_CHUNKS`)
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
            
            let textChunks = await splitter.splitText(docText.toString());
            
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
                WHERE SOURCEDOC_ID = '${req.data.sourceDocID}'
                `
            )
            //Start of RAG-Steps 
            const hyperparameters = {
                temperature: config.LLMTEMPERATURE
            }
            
            let amountCorrect = 0,amountFalse = 0,amountNone = 0;

            //retrieve chunks recording to question and config
            for (let task of tasks){
                const invector = await llm.embeddingAPI(task.QUESTION,config.EMBEDDINGMODEL);
                let retrievedChunks = await cds.run(`
                    SELECT content, cosine_similarity(embedding, to_real_vector('${invector}')) as similarity
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
                let LLMAnswerData = await llm.invokeLLM(config.RAGPROMPT,task.QUESTION, retrievedChunks, hyperparameters);
                const sLLLMAnswer = LLMAnswerData.data.answer;

                //build customKnowledge for judging
                const knowledgeForJudge = [
                    {
                        role: "user",
                        name: "knowledge",
                        content: `question:${task.QUESTION} correct Answer: ${task.ANSWER}`
                    },
                    {
                        role: "user",
                        name: "answer",
                        content: "answer to be judged:" + sLLLMAnswer
                    }
                ];
                const fixedHyperParameters = {
                    temperature: 0.5
                }
                //for every task let LLM judge if answer is correct
                let judgeAnswer = await llm.invokeLLM(prompts.judge,"",knowledgeForJudge,fixedHyperParameters);
                console.log(task.ANSWER)
                console.log(sLLLMAnswer)
                console.log(judgeAnswer)
                try {
                    if (judgeAnswer.data){
                        amountCorrect++;
                    } else {
                        amountFalse++;
                    }
                }
                catch {
                    amountNone++;
                }

            }

            //Insert results
            await cds.run (`
                INSERT INTO RAGEVAL_RESULTS VALUES
                ('${cds.utils.uuid()}','${req.data.configID}',${amountCorrect},${amountFalse},${amountNone})
            `)

            return {
                amountCorrect,
                amountFalse,
                amountNone
            }

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