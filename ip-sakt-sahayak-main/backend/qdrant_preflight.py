import os
import sys

from dotenv import load_dotenv

from qdrant_client import QdrantClient

load_dotenv()

COLLECTION_NAME = os.getenv(
    "QDRANT_COLLECTION",
    "ragvyn_hybrid_test",
)

EXPECTED_DENSE_NAME = "bge_m3"
EXPECTED_DENSE_SIZE = 1024
EXPECTED_DISTANCE = "cosine"
EXPECTED_SPARSE_NAME = "bm25"

EXPECTED_PAYLOAD_INDEXES = {
    "jurisdiction": "keyword",
    "authority": "keyword",
    "document_type": "keyword",
    "domain": "keyword",
    "document_id": "keyword",
    "section": "keyword",
    "language": "keyword",
    "publication_date": "datetime",
    "priority_date": "datetime",
}


def read_value(obj, key, default=None):
    if obj is None:
        return default

    if isinstance(obj, dict):
        return obj.get(key, default)

    return getattr(obj, key, default)


def normalize(value):
    if value is None:
        return ""

    enum_value = getattr(value, "value", value)

    return str(enum_value).lower().replace("_", "").replace("-", "")


def pass_check(message):
    print(f"[PASS] {message}")


def fail_check(message, failures):
    print(f"[FAIL] {message}")
    failures.append(message)


def pending_check(message):
    print(f"[PENDING] {message}")


def main():
    failures = []

    qdrant_url = os.getenv("QDRANT_URL")
    qdrant_api_key = os.getenv("QDRANT_API_KEY")

    if not qdrant_url:
        fail_check("QDRANT_URL is missing", failures)

    if not qdrant_api_key:
        fail_check("QDRANT_API_KEY is missing", failures)

    if failures:
        sys.exit(1)

    print(f"Checking collection: {COLLECTION_NAME}")
    print(f"Qdrant URL: {qdrant_url}")

    client = QdrantClient(
        url=qdrant_url,
        api_key=qdrant_api_key,
        timeout=40,
    )

    # Read-only collection inspection
    try:
        collection_info = client.get_collection(COLLECTION_NAME)
        pass_check(f"Collection exists: {COLLECTION_NAME}")
    except Exception as exc:
        fail_check(
            f"Collection could not be read: {exc}",
            failures,
        )
        sys.exit(1)

    config = read_value(collection_info, "config")
    params = read_value(config, "params")

    dense_vectors = read_value(params, "vectors")
    sparse_vectors = read_value(params, "sparse_vectors")

    # -----------------------------
    # Dense vector checks
    # -----------------------------

    if not isinstance(dense_vectors, dict):
        fail_check(
            "Dense vector configuration is not named-vector format",
            failures,
        )
    else:
        dense_config = dense_vectors.get(EXPECTED_DENSE_NAME)

        if dense_config is None:
            fail_check(
                f"Missing dense vector named '{EXPECTED_DENSE_NAME}'",
                failures,
            )
        else:
            dense_size = read_value(dense_config, "size")
            dense_distance = read_value(dense_config, "distance")

            if dense_size == EXPECTED_DENSE_SIZE:
                pass_check(
                    f"Dense vector '{EXPECTED_DENSE_NAME}' size is 1024"
                )
            else:
                fail_check(
                    f"Dense vector size is {dense_size}; expected 1024",
                    failures,
                )

            if normalize(dense_distance) == EXPECTED_DISTANCE:
                pass_check(
                    "Dense vector distance is Cosine"
                )
            else:
                fail_check(
                    f"Dense vector distance is {dense_distance}; expected Cosine",
                    failures,
                )

    # -----------------------------
    # Sparse vector checks
    # -----------------------------

    if not isinstance(sparse_vectors, dict):
        fail_check(
            "Sparse vector configuration is missing",
            failures,
        )
    else:
        sparse_config = sparse_vectors.get(EXPECTED_SPARSE_NAME)

        if sparse_config is None:
            fail_check(
                f"Missing sparse vector named '{EXPECTED_SPARSE_NAME}'",
                failures,
            )
        else:
            modifier = read_value(sparse_config, "modifier")

            if normalize(modifier) == "idf":
                pass_check(
                    "Sparse vector 'bm25' has IDF modifier enabled"
                )
            else:
                fail_check(
                    f"Sparse vector modifier is {modifier}; expected IDF",
                    failures,
                )

    # -----------------------------
    # Payload index checks
    # -----------------------------

    payload_schema = read_value(
        collection_info,
        "payload_schema",
        {},
    )

    if not isinstance(payload_schema, dict):
        payload_schema = {}

    for field_name, expected_type in EXPECTED_PAYLOAD_INDEXES.items():
        field_config = payload_schema.get(field_name)

        if field_config is None:
            fail_check(
                f"Payload index missing: {field_name}",
                failures,
            )
            continue

        actual_type = read_value(
            field_config,
            "data_type",
        )

        if actual_type is None:
            actual_type = read_value(
                field_config,
                "type",
            )

        if normalize(actual_type) == normalize(expected_type):
            pass_check(
                f"Payload index {field_name}: {expected_type}"
            )
        else:
            fail_check(
                f"Payload index {field_name} is {actual_type}; "
                f"expected {expected_type}",
                failures,
            )

    # -----------------------------
    # Collection size
    # -----------------------------

    points_count = read_value(
        collection_info,
        "points_count",
    )

    print(f"\nPoints currently stored: {points_count}")

    if points_count == 0:
        pending_check(
            "Collection is empty; hybrid point validation will happen after ingestion"
        )
    else:
        # Check whether an existing point contains both vectors.
        try:
            points, _ = client.scroll(
                collection_name=COLLECTION_NAME,
                limit=1,
                with_vectors=True,
                with_payload=False,
            )

            if not points:
                pending_check(
                    "No readable point found for vector validation"
                )
            else:
                point_vectors = read_value(points[0], "vector")

                if isinstance(point_vectors, dict):
                    has_dense = EXPECTED_DENSE_NAME in point_vectors
                    has_sparse = EXPECTED_SPARSE_NAME in point_vectors

                    if has_dense and has_sparse:
                        pass_check(
                            "Sample point contains both dense and sparse vectors"
                        )
                    elif has_dense and not has_sparse:
                        fail_check(
                            "Sample point contains dense vector but no bm25 sparse vector. "
                            "Hybrid ingestion is not complete.",
                            failures,
                        )
                    else:
                        fail_check(
                            "Sample point does not contain the expected named vectors",
                            failures,
                        )
                else:
                    fail_check(
                        "Sample point does not use named-vector format",
                        failures,
                    )

        except Exception as exc:
            fail_check(
                f"Could not inspect sample point vectors: {exc}",
                failures,
            )

    print("\n----------------------------------------")

    if failures:
        print("PREFLIGHT FAILED")
        print("\nProblems found:")
        for failure in failures:
            print(f"- {failure}")

        print("\nDo not create ragvyn_prod_v1 yet.")
        sys.exit(1)

    print("PREFLIGHT PASSED")
    print("\nThe collection schema is ready for Qdrant hybrid ingestion." )


if __name__ == "__main__":
    main()
