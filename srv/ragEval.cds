using ragEval from '../db/data-model';

service RAGEvalService {
    entity Results as projection on ragEval.Results;
    entity Configuration as projection on ragEval.Configuration;
    entity Chunks as projection on ragEval.Chunks;
    entity SourceDocuments as projection on ragEval.SourceDocuments;
    entity Tasks as projection on ragEval.Tasks;
    action test();
    action runTestForConfig(configID: String,sourceDocID: String);
    action taskGeneration(SourceID: String);
}