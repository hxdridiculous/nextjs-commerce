import {
  HIDDEN_PRODUCT_TAG,
  SHOPIFY_GRAPHQL_API_ENDPOINT,
  TAGS,
} from "lib/constants";
import { isShopifyError } from "lib/type-guards";
import { ensureStartsWith } from "lib/utils";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
  revalidateTag,
} from "next/cache";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  addToCartMutation,
  createCartMutation,
  editCartItemsMutation,
  removeFromCartMutation,
} from "./mutations/cart";
import {
  customerAccessTokenCreateMutation,
  customerAccessTokenDeleteMutation,
  customerAddressCreateMutation,
  customerAddressDeleteMutation,
  customerAddressUpdateMutation,
  customerCreateMutation,
  customerRecoverMutation,
  customerUpdateMutation,
} from "./mutations/customer";
import { getCartQuery } from "./queries/cart";
import {
  getCollectionProductsQuery,
  getCollectionQuery,
  getCollectionsQuery,
} from "./queries/collection";
import { getCustomerQuery } from "./queries/customer";
import { getMenuQuery } from "./queries/menu";
import { getPageQuery, getPagesQuery } from "./queries/page";
import {
  getProductQuery,
  getProductRecommendationsQuery,
  getProductsQuery,
} from "./queries/product";
import {
  Cart,
  Collection,
  Connection,
  Image,
  Menu,
  Page,
  Product,
  ShopifyAddToCartOperation,
  ShopifyCart,
  ShopifyCartOperation,
  ShopifyCollection,
  ShopifyCollectionOperation,
  ShopifyCollectionProductsOperation,
  ShopifyCollectionsOperation,
  ShopifyCreateCartOperation,
  ShopifyMenuOperation,
  ShopifyPageOperation,
  ShopifyPagesOperation,
  ShopifyProduct,
  ShopifyProductOperation,
  ShopifyProductRecommendationsOperation,
  ShopifyProductsOperation,
  ShopifyRemoveFromCartOperation,
  ShopifyUpdateCartOperation,
} from "./types";

const domain = process.env.SHOPIFY_STORE_DOMAIN
  ? ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, "https://")
  : "";
const endpoint = `${domain}${SHOPIFY_GRAPHQL_API_ENDPOINT}`;
const key = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

type ExtractVariables<T> = T extends { variables: object }
  ? T["variables"]
  : never;

export async function shopifyFetch<T>({
  headers,
  query,
  variables,
}: {
  headers?: HeadersInit;
  query: string;
  variables?: ExtractVariables<T>;
}): Promise<{ status: number; body: T } | never> {
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": key,
        ...headers,
      },
      body: JSON.stringify({
        ...(query && { query }),
        ...(variables && { variables }),
      }),
    });

    const body = await result.json();

    if (body.errors) {
      throw body.errors[0];
    }

    return {
      status: result.status,
      body,
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query,
      };
    }

    throw {
      error: e,
      query,
    };
  }
}

const removeEdgesAndNodes = <T>(array: Connection<T>): T[] => {
  return array.edges.map((edge) => edge?.node);
};

const reshapeCart = (cart: ShopifyCart): Cart => {
  if (!cart.cost?.totalTaxAmount) {
    cart.cost.totalTaxAmount = {
      amount: "0.0",
      currencyCode: cart.cost.totalAmount.currencyCode,
    };
  }

  return {
    ...cart,
    lines: removeEdgesAndNodes(cart.lines),
  };
};

const reshapeCollection = (
  collection: ShopifyCollection
): Collection | undefined => {
  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    path: `/search/${collection.handle}`,
  };
};

const reshapeCollections = (collections: ShopifyCollection[]) => {
  const reshapedCollections = [];

  for (const collection of collections) {
    if (collection) {
      const reshapedCollection = reshapeCollection(collection);

      if (reshapedCollection) {
        reshapedCollections.push(reshapedCollection);
      }
    }
  }

  return reshapedCollections;
};

const reshapeImages = (images: Connection<Image>, productTitle: string) => {
  const flattened = removeEdgesAndNodes(images);

  return flattened.map((image) => {
    const filename = image.url.match(/.*\/(.*)\..*/)?.[1];
    return {
      ...image,
      altText: image.altText || `${productTitle} - ${filename}`,
    };
  });
};

const reshapeProduct = (
  product: ShopifyProduct,
  filterHiddenProducts: boolean = true
) => {
  if (
    !product ||
    (filterHiddenProducts && product.tags.includes(HIDDEN_PRODUCT_TAG))
  ) {
    return undefined;
  }

  const { images, variants, ...rest } = product;

  return {
    ...rest,
    images: reshapeImages(images, product.title),
    variants: removeEdgesAndNodes(variants),
  };
};

const reshapeProducts = (products: ShopifyProduct[]) => {
  const reshapedProducts = [];

  for (const product of products) {
    if (product) {
      const reshapedProduct = reshapeProduct(product);

      if (reshapedProduct) {
        reshapedProducts.push(reshapedProduct);
      }
    }
  }

  return reshapedProducts;
};

export async function createCart(): Promise<Cart> {
  const res = await shopifyFetch<ShopifyCreateCartOperation>({
    query: createCartMutation,
  });

  return reshapeCart(res.body.data.cartCreate.cart);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value!;
  const res = await shopifyFetch<ShopifyAddToCartOperation>({
    query: addToCartMutation,
    variables: {
      cartId,
      lines,
    },
  });
  return reshapeCart(res.body.data.cartLinesAdd.cart);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value!;
  const res = await shopifyFetch<ShopifyRemoveFromCartOperation>({
    query: removeFromCartMutation,
    variables: {
      cartId,
      lineIds,
    },
  });

  return reshapeCart(res.body.data.cartLinesRemove.cart);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value!;
  const res = await shopifyFetch<ShopifyUpdateCartOperation>({
    query: editCartItemsMutation,
    variables: {
      cartId,
      lines,
    },
  });

  return reshapeCart(res.body.data.cartLinesUpdate.cart);
}

export async function getCart(): Promise<Cart | undefined> {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    return undefined;
  }

  const res = await shopifyFetch<ShopifyCartOperation>({
    query: getCartQuery,
    variables: { cartId },
  });

  // Old carts becomes `null` when you checkout.
  if (!res.body.data.cart) {
    return undefined;
  }

  return reshapeCart(res.body.data.cart);
}

export async function getCollection(
  handle: string
): Promise<Collection | undefined> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyCollectionOperation>({
    query: getCollectionQuery,
    variables: {
      handle,
    },
  });

  return reshapeCollection(res.body.data.collection);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.collections, TAGS.products);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyCollectionProductsOperation>({
    query: getCollectionProductsQuery,
    variables: {
      handle: collection,
      reverse,
      sortKey: sortKey === "CREATED_AT" ? "CREATED" : sortKey,
    },
  });

  if (!res.body.data.collection) {
    console.log(`No collection found for \`${collection}\``);
    return [];
  }

  return reshapeProducts(
    removeEdgesAndNodes(res.body.data.collection.products)
  );
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyCollectionsOperation>({
    query: getCollectionsQuery,
  });
  const shopifyCollections = removeEdgesAndNodes(res.body?.data?.collections);
  const collections = [
    {
      handle: "",
      title: "All",
      description: "All products",
      seo: {
        title: "All",
        description: "All products",
      },
      path: "/search",
      updatedAt: new Date().toISOString(),
    },
    // Filter out the `hidden` collections.
    // Collections that start with `hidden-*` need to be hidden on the search page.
    ...reshapeCollections(shopifyCollections).filter(
      (collection) => !collection.handle.startsWith("hidden")
    ),
  ];

  return collections;
}

export async function getMenu(handle: string): Promise<Menu[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyMenuOperation>({
    query: getMenuQuery,
    variables: {
      handle,
    },
  });

  return (
    res.body?.data?.menu?.items.map((item: { title: string; url: string }) => ({
      title: item.title,
      path: item.url
        .replace(domain, "")
        .replace("/collections", "/search")
        .replace("/pages", ""),
    })) || []
  );
}

export async function getPage(handle: string): Promise<Page> {
  const res = await shopifyFetch<ShopifyPageOperation>({
    query: getPageQuery,
    variables: { handle },
  });

  return res.body.data.pageByHandle;
}

export async function getPages(): Promise<Page[]> {
  const res = await shopifyFetch<ShopifyPagesOperation>({
    query: getPagesQuery,
  });

  return removeEdgesAndNodes(res.body.data.pages);
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyProductOperation>({
    query: getProductQuery,
    variables: {
      handle,
    },
  });

  return reshapeProduct(res.body.data.product, false);
}

export async function getProductRecommendations(
  productId: string
): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyProductRecommendationsOperation>({
    query: getProductRecommendationsQuery,
    variables: {
      productId,
    },
  });

  return reshapeProducts(res.body.data.productRecommendations);
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  const res = await shopifyFetch<ShopifyProductsOperation>({
    query: getProductsQuery,
    variables: {
      query,
      reverse,
      sortKey,
    },
  });

  return reshapeProducts(removeEdgesAndNodes(res.body.data.products));
}

// This is called from `app/api/revalidate.ts` so providers can control revalidation logic.
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  // We always need to respond with a 200 status code to Shopify,
  // otherwise it will continue to retry the request.
  const collectionWebhooks = [
    "collections/create",
    "collections/delete",
    "collections/update",
  ];
  const productWebhooks = [
    "products/create",
    "products/delete",
    "products/update",
  ];
  const topic = (await headers()).get("x-shopify-topic") || "unknown";
  const secret = req.nextUrl.searchParams.get("secret");
  const isCollectionUpdate = collectionWebhooks.includes(topic);
  const isProductUpdate = productWebhooks.includes(topic);

  if (!secret || secret !== process.env.SHOPIFY_REVALIDATION_SECRET) {
    console.error("Invalid revalidation secret.");
    return NextResponse.json({ status: 401 });
  }

  if (!isCollectionUpdate && !isProductUpdate) {
    // We don't need to revalidate anything for any other topics.
    return NextResponse.json({ status: 200 });
  }

  if (isCollectionUpdate) {
    revalidateTag(TAGS.collections);
  }

  if (isProductUpdate) {
    revalidateTag(TAGS.products);
  }

  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}

// Customer types
export interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  acceptsMarketing?: boolean;
  createdAt?: string;
  defaultAddress?: CustomerAddress;
  addresses?: CustomerAddress[];
  orders?: CustomerOrder[];
}

export interface CustomerAddress {
  id: string;
  address1?: string;
  address2?: string;
  city?: string;
  company?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  province?: string;
  zip?: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber?: string;
  processedAt?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalPrice?: Money;
  lineItems?: LineItem[];
}

export interface LineItem {
  title?: string;
  quantity?: number;
  variant?: {
    id: string;
    title?: string;
    image?: {
      url: string;
      altText?: string;
      width?: number;
      height?: number;
    };
    price?: Money;
  };
}

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface ShopifyCustomerOperation {
  data: {
    customer: ShopifyCustomer;
  };
}

export interface ShopifyCustomerAccessTokenOperation {
  data: {
    customerAccessTokenCreate: {
      customerAccessToken: {
        accessToken: string;
        expiresAt: string;
      };
      customerUserErrors: {
        field: string[];
        message: string;
        code: string;
      }[];
    };
  };
}

export interface ShopifyCustomerCreateOperation {
  data: {
    customerCreate: {
      customer: ShopifyCustomer;
      customerUserErrors: {
        field: string[];
        message: string;
        code: string;
      }[];
    };
  };
}

export interface ShopifyCustomerUpdateOperation {
  data: {
    customerUpdate: {
      customer: ShopifyCustomer;
      customerUserErrors: {
        field: string[];
        message: string;
        code: string;
      }[];
    };
  };
}

export interface ShopifyCustomerAddressCreateOperation {
  data: {
    customerAddressCreate: {
      customerAddress: ShopifyCustomerAddress;
      customerUserErrors: {
        field: string[];
        message: string;
        code: string;
      }[];
    };
  };
}

export interface ShopifyCustomerAddressUpdateOperation {
  data: {
    customerAddressUpdate: {
      customerAddress: ShopifyCustomerAddress;
      customerUserErrors: {
        field: string[];
        message: string;
        code: string;
      }[];
    };
  };
}

export interface ShopifyCustomerAddressDeleteOperation {
  data: {
    customerAddressDelete: {
      deletedCustomerAddressId: string;
      customerUserErrors: {
        field: string[];
        message: string;
        code: string;
      }[];
    };
  };
}

export interface ShopifyCustomer {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  acceptsMarketing?: boolean;
  createdAt?: string;
  defaultAddress?: ShopifyCustomerAddress;
  addresses?: {
    edges: {
      node: ShopifyCustomerAddress;
    }[];
  };
  orders?: {
    edges: {
      node: ShopifyCustomerOrder;
    }[];
  };
}

export interface ShopifyCustomerAddress {
  id: string;
  address1?: string;
  address2?: string;
  city?: string;
  company?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  province?: string;
  zip?: string;
}

export interface ShopifyCustomerOrder {
  id: string;
  orderNumber?: string;
  processedAt?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  currentTotalPrice?: {
    amount: string;
    currencyCode: string;
  };
  lineItems?: {
    edges: {
      node: {
        title?: string;
        quantity?: number;
        variant?: {
          id: string;
          title?: string;
          image?: {
            url: string;
            altText?: string;
            width?: number;
            height?: number;
          };
          price?: {
            amount: string;
            currencyCode: string;
          };
        };
      };
    }[];
  };
}

const reshapeCustomer = (customer: ShopifyCustomer): Customer => {
  if (!customer) {
    return {} as Customer;
  }

  const reshapedCustomer: Customer = {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    acceptsMarketing: customer.acceptsMarketing,
    createdAt: customer.createdAt,
    defaultAddress: customer.defaultAddress,
  };

  if (customer.addresses) {
    reshapedCustomer.addresses = customer.addresses.edges.map(({ node }) => ({
      id: node.id,
      address1: node.address1,
      address2: node.address2,
      city: node.city,
      company: node.company,
      country: node.country,
      firstName: node.firstName,
      lastName: node.lastName,
      phone: node.phone,
      province: node.province,
      zip: node.zip,
    }));
  }

  if (customer.orders) {
    reshapedCustomer.orders = customer.orders.edges.map(({ node }) => {
      const order: CustomerOrder = {
        id: node.id,
        orderNumber: node.orderNumber,
        processedAt: node.processedAt,
        financialStatus: node.financialStatus,
        fulfillmentStatus: node.fulfillmentStatus,
        totalPrice: node.currentTotalPrice,
      };

      if (node.lineItems) {
        order.lineItems = node.lineItems.edges.map(
          ({ node: lineItemNode }) => ({
            title: lineItemNode.title,
            quantity: lineItemNode.quantity,
            variant: lineItemNode.variant,
          })
        );
      }

      return order;
    });
  }

  return reshapedCustomer;
};

export async function createCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  acceptsMarketing?: boolean;
}): Promise<{ customer?: Customer; errors?: any[] }> {
  try {
    const res = await shopifyFetch<ShopifyCustomerCreateOperation>({
      query: customerCreateMutation,
      variables: {
        input,
      } as any,
    });

    if (res.body.data.customerCreate.customerUserErrors.length) {
      return {
        errors: res.body.data.customerCreate.customerUserErrors,
      };
    }

    return {
      customer: reshapeCustomer(res.body.data.customerCreate.customer),
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerCreateMutation,
      };
    }

    throw {
      error: e,
      query: customerCreateMutation,
    };
  }
}

export async function loginCustomer(input: {
  email: string;
  password: string;
}): Promise<{ accessToken?: string; expiresAt?: string; errors?: any[] }> {
  try {
    const res = await shopifyFetch<ShopifyCustomerAccessTokenOperation>({
      query: customerAccessTokenCreateMutation,
      variables: {
        input,
      } as any,
    });

    if (res.body.data.customerAccessTokenCreate.customerUserErrors.length) {
      return {
        errors: res.body.data.customerAccessTokenCreate.customerUserErrors,
      };
    }

    const { accessToken, expiresAt } =
      res.body.data.customerAccessTokenCreate.customerAccessToken;

    // Store the access token in a cookie
    const cookieStore = await cookies();
    cookieStore.set("customerAccessToken", accessToken, {
      expires: new Date(expiresAt),
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return {
      accessToken,
      expiresAt,
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerAccessTokenCreateMutation,
      };
    }

    throw {
      error: e,
      query: customerAccessTokenCreateMutation,
    };
  }
}

export async function logoutCustomer(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const customerAccessToken = cookieStore.get("customerAccessToken")?.value;

    if (!customerAccessToken) {
      return true;
    }

    await shopifyFetch({
      query: customerAccessTokenDeleteMutation,
      variables: {
        customerAccessToken,
      } as any,
    });

    cookieStore.delete("customerAccessToken");

    return true;
  } catch (e) {
    return false;
  }
}

export async function getCustomer(): Promise<Customer | null> {
  const cookieStore = await cookies();
  const customerAccessToken = cookieStore.get("customerAccessToken")?.value;

  if (!customerAccessToken) {
    return null;
  }

  try {
    const res = await shopifyFetch<ShopifyCustomerOperation>({
      query: getCustomerQuery,
      variables: {
        customerAccessToken,
      } as any,
    });

    return reshapeCustomer(res.body.data.customer);
  } catch (e) {
    return null;
  }
}

export async function updateCustomer(customer: {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  acceptsMarketing?: boolean;
}): Promise<{ customer?: Customer; errors?: any[] }> {
  const cookieStore = await cookies();
  const customerAccessToken = cookieStore.get("customerAccessToken")?.value;

  if (!customerAccessToken) {
    return { errors: [{ message: "Customer not logged in" }] };
  }

  try {
    const res = await shopifyFetch<ShopifyCustomerUpdateOperation>({
      query: customerUpdateMutation,
      variables: {
        customer: {
          ...customer,
          customerAccessToken,
        },
      } as any,
    });

    if (res.body.data.customerUpdate.customerUserErrors.length) {
      return {
        errors: res.body.data.customerUpdate.customerUserErrors,
      };
    }

    return {
      customer: reshapeCustomer(res.body.data.customerUpdate.customer),
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerUpdateMutation,
      };
    }

    throw {
      error: e,
      query: customerUpdateMutation,
    };
  }
}

export async function recoverCustomer(
  email: string
): Promise<{ success: boolean; errors?: any[] }> {
  try {
    const res = await shopifyFetch<any>({
      query: customerRecoverMutation,
      variables: {
        email,
      } as any,
    });

    const customerUserErrors = res.body.data.customerRecover.customerUserErrors;

    if (customerUserErrors.length) {
      return {
        success: false,
        errors: customerUserErrors,
      };
    }

    return {
      success: true,
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerRecoverMutation,
      };
    }

    throw {
      error: e,
      query: customerRecoverMutation,
    };
  }
}

export async function createCustomerAddress(address: {
  address1?: string;
  address2?: string;
  city?: string;
  company?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  province?: string;
  zip?: string;
}): Promise<{ customerAddress?: CustomerAddress; errors?: any[] }> {
  const cookieStore = await cookies();
  const customerAccessToken = cookieStore.get("customerAccessToken")?.value;

  if (!customerAccessToken) {
    return { errors: [{ message: "Customer not logged in" }] };
  }

  try {
    const res = await shopifyFetch<ShopifyCustomerAddressCreateOperation>({
      query: customerAddressCreateMutation,
      variables: {
        customerAccessToken,
        address,
      } as any,
    });

    if (res.body.data.customerAddressCreate.customerUserErrors.length) {
      return {
        errors: res.body.data.customerAddressCreate.customerUserErrors,
      };
    }

    return {
      customerAddress: res.body.data.customerAddressCreate.customerAddress,
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerAddressCreateMutation,
      };
    }

    throw {
      error: e,
      query: customerAddressCreateMutation,
    };
  }
}

export async function updateCustomerAddress(
  id: string,
  address: {
    address1?: string;
    address2?: string;
    city?: string;
    company?: string;
    country?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    province?: string;
    zip?: string;
  }
): Promise<{ customerAddress?: CustomerAddress; errors?: any[] }> {
  const cookieStore = await cookies();
  const customerAccessToken = cookieStore.get("customerAccessToken")?.value;

  if (!customerAccessToken) {
    return { errors: [{ message: "Customer not logged in" }] };
  }

  try {
    const res = await shopifyFetch<ShopifyCustomerAddressUpdateOperation>({
      query: customerAddressUpdateMutation,
      variables: {
        customerAccessToken,
        id,
        address,
      } as any,
    });

    if (res.body.data.customerAddressUpdate.customerUserErrors.length) {
      return {
        errors: res.body.data.customerAddressUpdate.customerUserErrors,
      };
    }

    return {
      customerAddress: res.body.data.customerAddressUpdate.customerAddress,
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerAddressUpdateMutation,
      };
    }

    throw {
      error: e,
      query: customerAddressUpdateMutation,
    };
  }
}

export async function deleteCustomerAddress(
  id: string
): Promise<{ success: boolean; errors?: any[] }> {
  const cookieStore = await cookies();
  const customerAccessToken = cookieStore.get("customerAccessToken")?.value;

  if (!customerAccessToken) {
    return { success: false, errors: [{ message: "Customer not logged in" }] };
  }

  try {
    const res = await shopifyFetch<ShopifyCustomerAddressDeleteOperation>({
      query: customerAddressDeleteMutation,
      variables: {
        customerAccessToken,
        id,
      } as any,
    });

    if (res.body.data.customerAddressDelete.customerUserErrors.length) {
      return {
        success: false,
        errors: res.body.data.customerAddressDelete.customerUserErrors,
      };
    }

    return {
      success: true,
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || "unknown",
        status: e.status || 500,
        message: e.message,
        query: customerAddressDeleteMutation,
      };
    }

    throw {
      error: e,
      query: customerAddressDeleteMutation,
    };
  }
}
