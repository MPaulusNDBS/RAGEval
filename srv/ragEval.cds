using ragEval from '../db/data-model';

service RAGEvalService {
    entity Results as projection on ragEval.Results;
    entity Configuration as projection on ragEval.Configuration;
    entity Chunks as projection on ragEval.Chunks;
}