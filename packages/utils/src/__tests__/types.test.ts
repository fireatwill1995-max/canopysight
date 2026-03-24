import { describe, it, expectTypeOf } from "vitest";
import type {
  PaginatedResponse,
  ApiResponse,
  ApiErrorResponse,
  SortDirection,
  SortParam,
  FilterParam,
} from "../types";

describe("PaginatedResponse type", () => {
  it("has data array and pagination object", () => {
    type TestResponse = PaginatedResponse<{ id: string; name: string }>;
    expectTypeOf<TestResponse>().toHaveProperty("data");
    expectTypeOf<TestResponse>().toHaveProperty("pagination");
  });

  it("pagination has required numeric and boolean fields", () => {
    type Pag = PaginatedResponse<unknown>["pagination"];
    expectTypeOf<Pag>().toHaveProperty("page");
    expectTypeOf<Pag>().toHaveProperty("pageSize");
    expectTypeOf<Pag>().toHaveProperty("totalItems");
    expectTypeOf<Pag>().toHaveProperty("totalPages");
    expectTypeOf<Pag>().toHaveProperty("hasNextPage");
    expectTypeOf<Pag>().toHaveProperty("hasPreviousPage");
  });

  it("data uses the generic type parameter", () => {
    type Item = { id: number };
    type Resp = PaginatedResponse<Item>;
    expectTypeOf<Resp["data"]>().toEqualTypeOf<Item[]>();
  });
});

describe("ApiResponse type", () => {
  it("has success, data, and optional meta", () => {
    type Resp = ApiResponse<string>;
    expectTypeOf<Resp>().toHaveProperty("success");
    expectTypeOf<Resp>().toHaveProperty("data");
    expectTypeOf<Resp>().toHaveProperty("meta");
  });

  it("data matches the generic parameter", () => {
    type Resp = ApiResponse<{ count: number }>;
    expectTypeOf<Resp["data"]>().toEqualTypeOf<{ count: number }>();
  });
});

describe("ApiErrorResponse type", () => {
  it("success is always false", () => {
    expectTypeOf<ApiErrorResponse["success"]>().toEqualTypeOf<false>();
  });

  it("error has required fields", () => {
    type Err = ApiErrorResponse["error"];
    expectTypeOf<Err>().toHaveProperty("code");
    expectTypeOf<Err>().toHaveProperty("message");
    expectTypeOf<Err>().toHaveProperty("statusCode");
  });
});

describe("SortDirection type", () => {
  it("is asc or desc", () => {
    expectTypeOf<"asc">().toMatchTypeOf<SortDirection>();
    expectTypeOf<"desc">().toMatchTypeOf<SortDirection>();
  });
});

describe("SortParam type", () => {
  it("has field and direction", () => {
    expectTypeOf<SortParam>().toHaveProperty("field");
    expectTypeOf<SortParam>().toHaveProperty("direction");
  });
});

describe("FilterParam type", () => {
  it("has field, operator, and value", () => {
    expectTypeOf<FilterParam>().toHaveProperty("field");
    expectTypeOf<FilterParam>().toHaveProperty("operator");
    expectTypeOf<FilterParam>().toHaveProperty("value");
  });
});
