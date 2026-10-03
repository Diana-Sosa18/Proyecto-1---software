FROM mysql:8.4

COPY init.sql /docker-entrypoint-initdb.d/init.sql
COPY migrations/001_recurrente_preparation.sql /docker-entrypoint-initdb.d/z001_recurrente_preparation.sql
COPY migrations/002_recurrente_checkout.sql /docker-entrypoint-initdb.d/z002_recurrente_checkout.sql
