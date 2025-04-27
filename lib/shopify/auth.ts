import { isShopifyError } from "lib/type-guards";
import { cookies } from "next/headers";
import { shopifyFetch } from "./index";
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
import { getCustomerQuery } from "./queries/customer";

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

export const reshapeCustomer = (customer: ShopifyCustomer): Customer => {
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
      const order: any = {
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
