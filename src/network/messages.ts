import { ChordNodeBase } from '../chord/node';

enum ChordRequestType {
  PING = 'PING',
  FIND_SUCCESSOR = 'FIND_SUCCESSOR',
  GET_PREDECESSOR = 'GET_PREDECESSOR',
  NOTIFY = 'NOTIFY',
  GET = 'GET',
  PUT = 'PUT',
  REMOVE = 'REMOVE',
}

enum ChordResponseType {
  PONG = 'PONG',
  FIND_SUCCESSOR_RESPONSE = 'FIND_SUCCESSOR_RESPONSE',
  GET_PREDECESSOR_RESPONSE = 'GET_PREDECESSOR_RESPONSE',
  NOTIFY_RESPONSE = 'NOTIFY_RESPONSE',
  GET_RESPONSE = 'GET_RESPONSE',
  PUT_RESPONSE = 'PUT_RESPONSE',
  REMOVE_RESPONSE = 'REMOVE_RESPONSE',
}

// Map requests to responses
function getResponseType(requestType: ChordRequestType): ChordResponseType {
  switch (requestType) {
    case ChordRequestType.PING:
      return ChordResponseType.PONG;
    case ChordRequestType.FIND_SUCCESSOR:
      return ChordResponseType.FIND_SUCCESSOR_RESPONSE;
    case ChordRequestType.GET_PREDECESSOR:
      return ChordResponseType.GET_PREDECESSOR_RESPONSE;
    case ChordRequestType.NOTIFY:
      return ChordResponseType.NOTIFY_RESPONSE;
    case ChordRequestType.GET:
      return ChordResponseType.GET_RESPONSE;
    case ChordRequestType.PUT:
      return ChordResponseType.PUT_RESPONSE;
    case ChordRequestType.REMOVE:
      return ChordResponseType.REMOVE_RESPONSE;
  }
}

type ChordMessageType = ChordRequestType | ChordResponseType;

type JSONSerializable = { [key: string]: any };

type ChordRequest = {
  type: ChordRequestType;
  sender: ChordNodeBase;
  data: JSONSerializable;
};

type ChordResponse = {
  type: ChordResponseType;
  sender: ChordNodeBase;
  data: JSONSerializable;
};

export type ChordMessage = ChordRequest | ChordResponse;

export {
  ChordRequestType,
  ChordResponseType,
  ChordMessageType,
  ChordRequest,
  ChordResponse,
  getResponseType,
};
