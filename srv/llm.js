const axios = require("axios");
const prompts = require("./prompts.json");
const cds = require("@sap/cds");

/**
 * @description
 * initializes an Axios Instance with:
 * - baseURL
 * - authorization (api-key)
 */
const initializeAxios = function () {
    const llm_api_base_url = "https://complianceanalyzerai.openai.azure.com";
    // Init instance of axios which works with llm_api_base_url
    const axiosInstance = axios.create({ baseURL: llm_api_base_url });
    axiosInstance.defaults.headers.common["api-key"] = process.env.api_key;
    return axiosInstance;
}

const axiosInstance = initializeAxios();

const invokeLLM = function (customPrompt, text, customKnowledge, hyperparameters) {

    const api = {
        "name": "completions",
        "model": "gpt-4o",
        "api_path": "/openai/deployments/MSNLLM-4o/chat/completions?api-version=2023-03-15-preview",
        "max_token": 2048,
        "temperature": hyperparameters.temperature
    }

    //Special process for ' and " in the text
    //Replace all ' with \', " with \"
    if (text !== undefined) {
        text = text.replace(/'/g, ' ');
    }
    //completions API
    let messages = [{ role: "user", content: `${text}` }];
    
    messages = [
        {
            role: "system",
            content: `${customPrompt}`
        },
        {
            role: "user",
            content: `${text}`
        },
    ];
    if (customKnowledge !== undefined && Array.isArray(customKnowledge)) {
        messages = customKnowledge.concat(messages)
    }
    return new Promise(function (resolve, reject) {
        axiosInstance
            .request({
                url: api.api_path,
                method: "POST",
                data: {
                    model: api.model,
                    messages: messages,
                    temperature: hyperparameters.temperature,
                },
            })
            .then((res) => {
                const message = res.data.choices[0].message;
                const replyText = message.content.replace(/\n/g, " ");
                let result = { data: { answer: "" }, created_at: "", total_tokens: 0 };
                try {
                    result.data = JSON.parse(replyText);
                } catch {

                    result.data = { answer: replyText }
                    console.log('No JSON Reply from AI')
                }
                result.created_at = res.data.created;
                result.total_tokens = res.data.usage.total_tokens;
                resolve(result);
                resolve(res.data);
            })
            .catch((err) => {
                console.log('Uppps! The AI functionality fall a sleep.' + JSON.stringify(err))
                // reject(err);
                resolve({ data: { answer: 'Uppps! The AI functionality fall asleep. Contact an admin to wake up softly the AI by reading telling it a story about: "' + err.message + '" ...' } })
            });
        });
};


const embeddingAPI = async function (text, model, hyperparameters){
    let data = { model: model, input: text };
        return new Promise(function (resolve, reject) {
            setTimeout(() => {
                axiosInstance
                    .request({
                        url: "/openai/deployments/MSNEmbedding/embeddings?api-version=2023-09-15-preview",
                        method: "POST",
                        data: data,
                    })
                    .then((res) => {
                        console.log(res.data);
                        const result = res.data.data[0].embedding.toString();
                        resolve(`[${result}]`);
                    })
                    .catch((err) => {
                        console.log("ERROR:" + err)
                        reject(err);
                    });
            }, 150);
        });
    }

const taskCreator = async function (DocSourceID){
    const docText = await cds.run(
        `SELECT Content FROM RAGEVAL_SOURCEDOCUMENTS
        WHERE ID = '${DocSourceID}'`
    )
    const message = {
        role: "user",
        content: docText[0].CONTENT.toString()
    }
    let result = await this.invokeLLM(prompts.taskCreationPrompt,"Please Create Tasks for this Document",[message],{temperature:0.5});
    console.log(result);
    return result;
}

module.exports = { invokeLLM, embeddingAPI, initializeAxios, taskCreator };
