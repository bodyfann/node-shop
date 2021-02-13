const deleteProduct = (btn) => {
  const prodId = btn.parentNode.querySelector("[name=productId]").value;
  const csrf = btn.parentNode.querySelector("[name=_csrf]").value;

  const productElement = btn.closest("article");

  fetch("/admin/product/" + prodId, {
    method: "DELETE",
    headers: {
      "csrf-token": csrf,
    },
  })
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      console.log(data);
      productElement.parentNode.removeChild(productElement);
    })
    .catch((err) => {
      console.log(err);
    });
};

const completePayPalPayment = (data, csrf) => {
  fetch("/checkout/success/paypal", {
    method: "POST",
    headers: {
      "csrf-token": csrf,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      orderID: data.orderID,
      payerID: data.payerID,
    }),
  })
    .then((responseFromServer) => {
      if (responseFromServer.status === 200) {
        location.href = "/orders";
      } else {
        alert("Something bad happened :(");
        location.href = "/checkout/cancel";
      }
    })
    .catch((err) => {
      console.log(err);
    });
};
