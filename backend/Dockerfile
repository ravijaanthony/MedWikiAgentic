# ---- builder ---------------------------------------------------------------
# Needs gcc/musl-dev/libffi-dev/openssl-dev to compile:
#   cryptography (python-jose), uvloop (uvicorn[standard]), and any C-ext wheels
#   that don't ship musllinux pre-builds.
FROM python:3.11-alpine AS builder

RUN apk add --no-cache gcc musl-dev libffi-dev openssl-dev

WORKDIR /app

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY pyproject.toml .
# Install production deps only (no [dev] extras)
RUN pip install --no-cache-dir .

# ---- runtime ---------------------------------------------------------------
FROM python:3.11-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY app ./app

USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
