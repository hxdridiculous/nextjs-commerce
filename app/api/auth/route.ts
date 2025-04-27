import {
  createCustomer,
  getCustomer,
  loginCustomer,
  logoutCustomer,
  updateCustomer,
} from "lib/shopify/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const data = await request.json();
  const { action, ...params } = data;

  switch (action) {
    case "login":
      try {
        const result = await loginCustomer(params);
        return NextResponse.json(result);
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || "Login failed" },
          { status: 500 }
        );
      }

    case "register":
      try {
        const result = await createCustomer(params);
        return NextResponse.json(result);
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || "Registration failed" },
          { status: 500 }
        );
      }

    case "update":
      try {
        const result = await updateCustomer(params);
        return NextResponse.json(result);
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || "Update failed" },
          { status: 500 }
        );
      }

    case "logout":
      try {
        await logoutCustomer();
        return NextResponse.json({ success: true });
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || "Logout failed" },
          { status: 500 }
        );
      }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function GET() {
  try {
    const customer = await getCustomer();
    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get customer" },
      { status: 500 }
    );
  }
}
