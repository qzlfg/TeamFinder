from fastapi import FastAPI

from src.core.exceptions import setup_exception_handlers

app = FastAPI()

setup_exception_handlers(app)