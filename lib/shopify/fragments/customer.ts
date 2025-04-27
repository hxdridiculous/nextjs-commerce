import addressFragment from "./address";

const customerFragment = /* GraphQL */ `
  fragment customer on Customer {
    id
    firstName
    lastName
    displayName
    email
    phone
    acceptsMarketing
    createdAt
    defaultAddress {
      ...address
    }
    addresses(first: 10) {
      edges {
        node {
          ...address
        }
      }
    }
    orders(first: 5) {
      edges {
        node {
          id
          orderNumber
          processedAt
          financialStatus
          fulfillmentStatus
          currentTotalPrice {
            amount
            currencyCode
          }
          lineItems(first: 5) {
            edges {
              node {
                title
                quantity
                variant {
                  id
                  title
                  image {
                    url
                    altText
                    width
                    height
                  }
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ${addressFragment}
`;

export default customerFragment;
