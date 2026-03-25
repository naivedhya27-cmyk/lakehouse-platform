"""
Database Module - Async PostgreSQL with SQLAlchemy
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass
from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from api.core.config import settings

# Convert sync URL to async
db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(db_url, echo=settings.DEBUG, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class ClusterModel(Base):
    __tablename__ = "clusters"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    state = Column(String, default="PENDING")
    state_message = Column(Text, default="")
    num_workers = Column(Integer, default=2)
    spark_version = Column(String, default="3.5.0")
    node_type_id = Column(String)
    spark_conf = Column(JSON, default={})
    creator = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    terminated_at = Column(DateTime(timezone=True), nullable=True)


class JobModel(Base):
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    tasks = Column(JSON, default=[])
    schedule = Column(JSON, nullable=True)
    max_concurrent_runs = Column(Integer, default=1)
    creator = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class JobRunModel(Base):
    __tablename__ = "job_runs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    state = Column(String, default="PENDING")
    result_state = Column(String, nullable=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)


class NotebookModel(Base):
    __tablename__ = "notebooks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    path = Column(String, unique=True, nullable=False)
    language = Column(String, default="python")
    content = Column(Text, default="")
    creator = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ApiKeyModel(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key_hash = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    username = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)


async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    """Dependency for getting async database session"""
    async with async_session() as session:
        yield session
