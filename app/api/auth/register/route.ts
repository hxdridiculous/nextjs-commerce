import { createCustomer } from "lib/shopify/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone, acceptsMarketing } =
      await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await createCustomer({
      email,
      password,
      firstName,
      lastName,
      phone,
      acceptsMarketing,
    });

    if (result.errors && result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      customerId: result.customer?.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 }
    );
  }
}
