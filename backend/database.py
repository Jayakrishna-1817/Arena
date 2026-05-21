"""
database.py – In-memory storage (for demo purposes)
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

# In-memory "collections"
_users: Dict[str, Dict[str, Any]] = {}
_rooms: Dict[str, Dict[str, Any]] = {}
_rounds: Dict[str, Dict[str, Any]] = {}
_participants: Dict[str, Dict[str, Any]] = {}
_submissions: Dict[str, Dict[str, Any]] = {}
_generation_jobs: Dict[str, Dict[str, Any]] = {}
_scores: Dict[str, Dict[str, Any]] = {}

# Indexes
_email_to_user: Dict[str, str] = {}
_code_to_room: Dict[str, str] = {}
_room_rounds: Dict[str, List[str]] = {}
_room_participants: Dict[str, List[str]] = {}
_round_submissions: Dict[str, List[str]] = {}
_submission_jobs: Dict[str, List[str]] = {}


class AsyncCursor:
    def __init__(self, items):
        self.items = items
        self.index = 0
    
    async def __aiter__(self):
        return self
    
    async def __anext__(self):
        if self.index < len(self.items):
            item = self.items[self.index]
            self.index += 1
            return item
        else:
            raise StopAsyncIteration
    
    async def to_list(self, length=None):
        return self.items
    
    def sort(self, field, direction=1):
        self.items.sort(key=lambda x: x[field], reverse=(direction == -1))
        return self


class InMemoryDB:
    def __init__(self):
        self.users = InMemoryCollection("users", _users, _email_to_user, "email")
        self.rooms = InMemoryCollection("rooms", _rooms, _code_to_room, "code")
        self.rounds = InMemoryCollection("rounds", _rounds)
        self.participants = InMemoryCollection("participants", _participants)
        self.submissions = InMemoryCollection("submissions", _submissions)
        self.generation_jobs = InMemoryCollection("generation_jobs", _generation_jobs)
        self.scores = InMemoryCollection("scores", _scores)


class InMemoryCollection:
    def __init__(self, name: str, data: Dict[str, Dict], index: Optional[Dict] = None, index_field: Optional[str] = None):
        self.name = name
        self._data = data
        self._index = index
        self._index_field = index_field

    async def insert_one(self, doc: Dict[str, Any]) -> Any:
        def serialize_datetime(v):
            if isinstance(v, datetime):
                return v.isoformat()
            return v
        
        processed_doc = {}
        for k, v in doc.items():
            processed_doc[k] = serialize_datetime(v)
        
        processed_doc["created_at"] = processed_doc.get("created_at", datetime.utcnow().isoformat())
        processed_doc["updated_at"] = datetime.utcnow().isoformat()
        
        self._data[processed_doc["id"]] = processed_doc
        
        if self._index and self._index_field and self._index_field in processed_doc:
            self._index[processed_doc[self._index_field]] = processed_doc["id"]
            
        return type('InsertOneResult', (object,), {'inserted_id': processed_doc["id"]})()

    async def insert_many(self, docs: List[Dict[str, Any]]) -> Any:
        inserted_ids = []
        for doc in docs:
            result = await self.insert_one(doc)
            inserted_ids.append(result.inserted_id)
        return type('InsertManyResult', (object,), {'inserted_ids': inserted_ids})()

    async def find_one(self, filter: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if "id" in filter:
            return self._data.get(filter["id"])
        
        if self._index and self._index_field and self._index_field in filter:
            doc_id = self._index.get(filter[self._index_field])
            if doc_id:
                return self._data.get(doc_id)
        
        for doc in self._data.values():
            match = True
            for k, v in filter.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc
        return None

    def find(self, filter: Dict[str, Any]) -> AsyncCursor:
        results = []
        for doc in self._data.values():
            match = True
            for k, v in filter.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                results.append(doc)
        return AsyncCursor(results)
    
    async def count_documents(self, filter: Dict[str, Any]) -> int:
        count = 0
        for doc in self._data.values():
            match = True
            for k, v in filter.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    async def update_one(self, filter: Dict[str, Any], update: Dict[str, Any]) -> Any:
        def serialize_datetime(v):
            if isinstance(v, datetime):
                return v.isoformat()
            return v
        
        doc = await self.find_one(filter)
        if doc:
            if "$set" in update:
                processed_set = {}
                for k, v in update["$set"].items():
                    processed_set[k] = serialize_datetime(v)
                doc.update(processed_set)
            doc["updated_at"] = datetime.utcnow().isoformat()
            self._data[doc["id"]] = doc
            return type('UpdateResult', (object,), {'modified_count': 1})()
        return type('UpdateResult', (object,), {'modified_count': 0})()

    async def update_many(self, filter: Dict[str, Any], update: Dict[str, Any]) -> Any:
        def serialize_datetime(v):
            if isinstance(v, datetime):
                return v.isoformat()
            return v
        
        count = 0
        for doc_id, doc in list(self._data.items()):
            match = True
            for k, v in filter.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    processed_set = {}
                    for k, v in update["$set"].items():
                        processed_set[k] = serialize_datetime(v)
                    doc.update(processed_set)
                doc["updated_at"] = datetime.utcnow().isoformat()
                self._data[doc_id] = doc
                count += 1
        return type('UpdateResult', (object,), {'modified_count': count})()

    async def delete_one(self, filter: Dict[str, Any]) -> Any:
        doc = await self.find_one(filter)
        if doc:
            del self._data[doc["id"]]
            return type('DeleteResult', (object,), {'deleted_count': 1})()
        return type('DeleteResult', (object,), {'deleted_count': 0})()

    async def create_index(self, field: str, unique: bool = False) -> None:
        pass


_db: Optional[InMemoryDB] = None


def get_db() -> InMemoryDB:
    global _db
    if _db is None:
        _db = InMemoryDB()
    return _db


async def close_db():
    global _db
    _db = None


async def create_indexes():
    pass
